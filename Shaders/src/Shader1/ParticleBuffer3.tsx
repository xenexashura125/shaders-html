import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

/**
 * ------------------------------------------------------------------
 * 1. THE "ECO-SYSTEM" SHADER
 * ------------------------------------------------------------------
 */
const ForestMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 60.0, // Slightly adjusted for clarity
    uColorTrunk: new THREE.Color("#00ff99"), 
    uColorGrass: new THREE.Color("#2d5a27"), 
    uColorPetal: new THREE.Color("#ccff00"), 
  },
  // --- VERTEX SHADER ---
  `
  varying vec3 vColor;
  varying float vType; // 0=Trunk, 1=Grass, 2=Petal, 3=Root
  varying float vAlpha;

  uniform float uTime;
  uniform float uSize;

  attribute float aType;
  attribute float aPhase; 
  attribute float aSpeed; 

  float hash(vec3 p) {
    p  = fract( p*0.3183099+.1 );
    p *= 17.0;
    return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
  }

  float noise(in vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix( hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)),f.x),
                   mix( hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)),f.x),
                   mix( hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)),f.x),f.y),f.z);
  }

  void main() {
    vColor = color;
    vType = aType;
    vec3 pos = position;

    // --- GRASS (Type 1) ---
    if (aType > 0.5 && aType < 1.5) {
        float wind = sin(uTime * 0.5 + pos.x * 0.5 + pos.z * 0.5 + aPhase);
        pos.x += wind * 0.2;
        pos.z += cos(uTime * 0.3 + aPhase) * 0.1;
        vAlpha = smoothstep(60.0, 10.0, length(pos.xz));
    }
    
    // --- PETALS (Type 2) ---
    else if (aType > 1.5 && aType < 2.5) {
        float fallHeight = 40.0;
        float yOffset = mod(uTime * aSpeed + aPhase, fallHeight);
        pos.y = 35.0 - yOffset; 
        
        float spiral = uTime * 0.5 + aPhase;
        pos.x += cos(spiral) * 2.0 * noise(pos * 0.1);
        pos.z += sin(spiral) * 2.0 * noise(pos * 0.1);
        
        float h = pos.y; 
        vAlpha = smoothstep(-2.0, 2.0, h) * smoothstep(35.0, 30.0, h);
    } 

    // --- ROOTS (Type 3) ---
    else if (aType > 2.5) {
        // Roots don't move much, maybe a tiny pulse
        vAlpha = 1.0;
    }
    
    // --- TRUNK (Type 0) ---
    else {
        float heightFactor = max(0.0, pos.y);
        // Sway increases with height
        pos.x += sin(uTime * 0.5 + aPhase) * 0.02 * heightFactor;
        vAlpha = 1.0;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    float finalSize = uSize;
    if (aType > 1.5 && aType < 2.5) finalSize *= 1.8; // Petals
    if (aType > 0.5 && aType < 1.5) finalSize *= 0.6; // Grass
    if (aType > 2.5) finalSize *= 1.2; // Roots are thick

    gl_PointSize = finalSize * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
  `,
  // --- FRAGMENT SHADER ---
  `
  varying vec3 vColor;
  varying float vType;
  varying float vAlpha;
  
  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    
    vec3 finalColor = vColor;
    // Boost petal brightness
    if (vType > 1.5 && vType < 2.5) finalColor *= 2.5; 

    gl_FragColor = vec4(finalColor, vAlpha * glow);
  }
  `
);

extend({ ForestMaterial });

/**
 * ------------------------------------------------------------------
 * 2. THE FOREST ENGINE CLASS
 * ------------------------------------------------------------------
 */
class ForestGenerator {
    constructor() {
        this.positions = [];
        this.colors = [];
        this.types = [];  // 0:Trunk, 1:Grass, 2:Petal, 3:Root
        this.phases = []; 
        this.speeds = []; 

        this.forestSize = 10; 
        this.treeCount = 8;
        this.minDist = 1;    
        
        // Colors
        this.colTrunk = new THREE.Color("#5dff48");
        this.colTips = new THREE.Color("#e034e2");
        this.colGrass = new THREE.Color("#79a379"); 
        this.colPetal = new THREE.Color("#ff66ff"); 
        this.colRoot  = new THREE.Color("#2ec11b"); // Earthy brown/orange for roots
    }

    build() {
        this.resetBuffers();
        
        const treeLocations = this.getPoissonLocations();
        
        treeLocations.forEach((loc, index) => {
        const height = 3 + Math.random() * 5;
        const depth = 10; 
        
        // 1. Grow Tree Upwards
        this.generateRecursiveTree(loc, height, depth, index);
        
        // 2. Grow Roots Downwards
        this.generateRoots(loc, height * 0.4, 3, index);
        });

        this.generateGrassField(50000); 
        // this.generatePetals(2000); 

        return {
        pos: new Float32Array(this.positions),
        col: new Float32Array(this.colors),
        type: new Float32Array(this.types),
        phase: new Float32Array(this.phases),
        speed: new Float32Array(this.speeds),
        count: this.positions.length / 3
        };
    }

    resetBuffers() {
        this.positions = []; this.colors = []; this.types = []; this.phases = []; this.speeds = [];
    }

    getPoissonLocations() {
        const locations = [];
        let attempts = 0;
        while (locations.length < this.treeCount && attempts < 2000) {
        attempts++;
        const x = (Math.random() - 0.5) * 2 * this.forestSize;
        const z = (Math.random() - 0.5) * 2 * this.forestSize;
        let tooClose = false;
        for (let loc of locations) {
            if (loc.distanceTo(new THREE.Vector3(x, 0, z)) < this.minDist) {
            tooClose = true; break;
            }
        }
        if (!tooClose) locations.push(new THREE.Vector3(x, 0, z));
        }
        return locations;
    }

    // --- TRUNK RECURSION ---
    generateRecursiveTree(origin, scale, maxDepth, seed) {
        const grow = (start, dir, length, depth) => {
        if (depth === 0) return;

        // Draw Segment
        const segments = 6;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const p = new THREE.Vector3().copy(start).lerp(
            new THREE.Vector3().copy(start).add(new THREE.Vector3().copy(dir).multiplyScalar(length)), t
            );
            // Jitter
            p.x += (Math.random() - 0.5) * 0.15;
            p.z += (Math.random() - 0.5) * 0.15;

            this.pushParticle(p.x, p.y, p.z, 0, seed, 0); 

            const ratio = 1.0 - (depth / maxDepth);
            const c = this.colTrunk.clone().lerp(this.colTips, ratio);
            this.colors.push(c.r, c.g, c.b);
        }

        const end = new THREE.Vector3().copy(start).add(new THREE.Vector3().copy(dir).multiplyScalar(length));
        
        // Branching - Forced Gaps
        const branchCount = Math.random() > 0.4 ? 3 : 2;
        for (let i = 0; i < branchCount; i++) {
            const newDir = dir.clone();
            
            // WIDER SPREAD for gaps
            const spread = 0.6 + (Math.random() * 0.6); 
            
            const axisX = new THREE.Vector3(1, 0, 0);
            const axisY = new THREE.Vector3(0, 1, 0);
            const axisZ = new THREE.Vector3(0, 0, 1);
            
            // Rotation offset by seed to make every tree different
            newDir.applyAxisAngle(axisY, (Math.PI * 2 / branchCount) * i + (seed * 0.5)); 
            newDir.applyAxisAngle(axisX, spread * (Math.random() - 0.5));       
            newDir.applyAxisAngle(axisZ, spread * (Math.random() - 0.5));
            
            newDir.normalize();
            grow(end, newDir, length * 0.7, depth - 1);
        }
        };
        grow(origin, new THREE.Vector3(0, 1, 0), scale / 3, maxDepth);
    }

    // --- ROOT RECURSION (New!) ---
    generateRoots(origin, scale, maxDepth, seed) {
        const growRoot = (start, dir, length, depth) => {
            if (depth === 0) return;

            const segments = 5;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const p = new THREE.Vector3().copy(start).lerp(
                    new THREE.Vector3().copy(start).add(new THREE.Vector3().copy(dir).multiplyScalar(length)), t
                );
                // Roots are messy
                p.x += (Math.random() - 0.5) * 0.2;
                p.z += (Math.random() - 0.5) * 0.2;
                
                // Push as Type 3 (Root)
                this.pushParticle(p.x, p.y, p.z, 3, seed, 0);
                
                // Darker colors for roots
                const c = this.colRoot.clone().multiplyScalar(0.5 + (depth/maxDepth)*0.5);
                this.colors.push(c.r, c.g, c.b);
            }

            const end = new THREE.Vector3().copy(start).add(new THREE.Vector3().copy(dir).multiplyScalar(length));

            // Roots split and go DOWN/OUT
            const branchCount = 2; // Roots split less often
            for (let i = 0; i < branchCount; i++) {
                const newDir = dir.clone();
                
                // Spread downwards
                const spread = 0.5;
                const axisY = new THREE.Vector3(0, 1, 0);
                
                newDir.applyAxisAngle(axisY, (Math.PI * 2 / branchCount) * i + Math.random());
                // Force downward tendency
                newDir.y -= 0.4; 
                newDir.normalize();

                growRoot(end, newDir, length * 0.8, depth - 1);
            }
        };
        
        // Initial Root Directions (spread out from base)
        for(let i=0; i<5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const dir = new THREE.Vector3(Math.cos(angle), -0.5, Math.sin(angle)).normalize();
            growRoot(origin, dir, scale / 2, maxDepth);
        }
    }

    generateGrassField(count) {
        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * 2 * this.forestSize;
            const z = (Math.random() - 0.5) * 2 * this.forestSize;
            // Grass height noise
            const y = -0.2; 
            
            this.pushParticle(x, y, z, 1, Math.random() * 100, 0);
            const c = this.colGrass.clone().multiplyScalar(0.6 + Math.random() * 0.6);
            this.colors.push(c.r, c.g, c.b);
        }
    }

    generatePetals(count) {
        for(let i=0; i<count; i++) {
            const x = (Math.random() - 0.5) * 2 * this.forestSize;
            const z = (Math.random() - 0.5) * 2 * this.forestSize;
            const y = 0; 
            const speed = 1.0 + Math.random() * 2.5; 
            this.pushParticle(x, y, z, 2, Math.random() * 100, speed);
            this.colors.push(this.colPetal.r, this.colPetal.g, this.colPetal.b);
        }
    }

    pushParticle(x, y, z, type, phase, speed) {
        this.positions.push(x, y, z);
        this.types.push(type);
        this.phases.push(phase);
        this.speeds.push(speed);
    }
}

/**
 * ------------------------------------------------------------------
 * 3. THE REACT COMPONENT
 * ------------------------------------------------------------------
 */
export const ParticleBuffer3 = () => {
    const meshRef = useRef();

    const data = useMemo(() => {
        const engine = new ForestGenerator();
        return engine.build();
    }, []);

    useFrame((state) => {
        if (meshRef.current) {
        meshRef.current.material.uTime = state.clock.getElapsedTime();
        meshRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.03) * 0.05;
        }
    });

    return (
        <group>
        <fog attach="fog" args={['#020202', 5, 60]} />
        <points ref={meshRef}>
            <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={data.count} array={data.pos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={data.count} array={data.col} itemSize={3} />
            <bufferAttribute attach="attributes-aType" count={data.count} array={data.type} itemSize={1} />
            <bufferAttribute attach="attributes-aPhase" count={data.count} array={data.phase} itemSize={1} />
            <bufferAttribute attach="attributes-aSpeed" count={data.count} array={data.speed} itemSize={1} />
            </bufferGeometry>
            {/* @ts-ignore */}
            <forestMaterial 
            transparent 
            depthWrite={false} 
            blending={THREE.AdditiveBlending} 
            vertexColors 
            />
        </points>
        </group>
    );
};