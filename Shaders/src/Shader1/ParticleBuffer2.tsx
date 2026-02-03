import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

const CityGlobeMaterial = shaderMaterial(
    {
        uTime: 0,
        uSize: 15.0,
        uScanPos: 0.0, // New: Controls the vertical position of the scan beam
    },
    `
    varying vec3 vColor;
    varying float vOpacity;
    varying float vScanHighlight;
    uniform float uTime;
    uniform float uSize;
    uniform float uScanPos;

    void main() {
        vColor = color;
        vec3 pos = position;

        float grid = 0.5;
        vec3 snappedPos = floor(pos / grid) * grid;
        
        float wave = sin(uTime * 1.5 + (snappedPos.x * snappedPos.z)) * 0.5 + 0.5;
        vec3 dir = normalize(pos);
        pos += dir * (wave * 0.8);

        // --- Atmospheric Scan Logic ---
        // Calculate distance from the current scan line height
        float scanWidth = 0.5;
        float distToScan = abs(pos.y - uScanPos);
        vScanHighlight = smoothstep(scanWidth, 0.0, distToScan);

        vOpacity = step(0.1, fract(sin(dot(snappedPos.xyz ,vec3(12.9898,78.233,45.164))) * 43758.5453));

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = uSize * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
    `,
    `
    varying vec3 vColor;
    varying float vOpacity;
    varying float vScanHighlight;
    
    void main() {
        float dist = max(abs(gl_PointCoord.x - 0.5), abs(gl_PointCoord.y - 0.5));
        if (dist > 0.45) discard;
        
        float glow = 1.0 - smoothstep(0.0, 0.45, dist);
        
        // Mix the base color with a bright white/cyan for the scan highlight
        vec3 scanColor = vec3(1.0, 1.0, 1.0); 
        vec3 finalColor = mix(vColor, scanColor, vScanHighlight * 0.8);
        
        gl_FragColor = vec4(finalColor + glow * 0.2, vOpacity * 0.9);
    }
    `
    );

    // Traffic shader remains largely the same but with higher brightness
    const TrafficMaterial = shaderMaterial(
    { uTime: 0, uSize: 50.0 },
    `
    varying vec3 vColor;
    uniform float uTime;
    uniform float uSize;
    attribute float aSpeed;
    attribute float aOffset;
    attribute vec3 aAxis;

    vec3 rotate(vec3 v, vec3 axis, float angle) {
        float s = sin(angle); float c = cos(angle); float oc = 1.0 - c;
        return v * c + cross(axis, v) * s + axis * dot(axis, v) * oc;
    }

    void main() {
        vColor = color;
        float angle = uTime * aSpeed + aOffset;
        vec3 pos = rotate(position, aAxis, angle);
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = uSize * (1.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
    `,
    `
    varying vec3 vColor;
    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        if (dist > 0.5) discard;
        gl_FragColor = vec4(vColor * 3.0, 1.0 - smoothstep(0.0, 0.5, dist));
    }
    `
);

extend({ CityGlobeMaterial, TrafficMaterial });

export const ParticleBuffer2 = () => {
    const globeRef = useRef();
    const trafficRef = useRef();
    const globeCount = 80000;
    const trafficCount = 500;

    const [globePos, globeCol] = useMemo(() => {
        const pos = new Float32Array(globeCount * 3);
        const col = new Float32Array(globeCount * 3);
        const c1 = new THREE.Color("#00f2ff"), c2 = new THREE.Color("#7000ff");

        for (let i = 0; i < globeCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / globeCount);
            const theta = Math.sqrt(globeCount * Math.PI) * phi;
            const r = 4;
            pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
            pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            pos[i * 3 + 2] = r * Math.cos(phi);
            const mixed = c1.clone().lerp(c2, Math.abs(pos[i * 3 + 1]) / r);
            col[i * 3] = mixed.r; col[i * 3 + 1] = mixed.g; col[i * 3 + 2] = mixed.b;
        }
        return [pos, col]; // Fixed the naming bug here!
    }, []);

    const trafficData = useMemo(() => {
        const pos = new Float32Array(trafficCount * 3);
        const col = new Float32Array(trafficCount * 3);
        const speeds = new Float32Array(trafficCount);
        const offsets = new Float32Array(trafficCount);
        const axes = new Float32Array(trafficCount * 3);

        for (let i = 0; i < trafficCount; i++) {
            const r = 4.3 + Math.random() * 1.2;
            pos[i * 3] = r;
            const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
            axes[i * 3] = axis.x; axes[i * 3 + 1] = axis.y; axes[i * 3 + 2] = axis.z;
            speeds[i] = (Math.random() + 0.5) * 1.5;
            offsets[i] = Math.random() * 100;
            const c = Math.random() > 0.5 ? new THREE.Color("#00ffff") : new THREE.Color("#ffffff");
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        return { pos, col, speeds, offsets, axes };
    }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (globeRef.current) {
            globeRef.current.material.uTime = t;
            // Animate the scan line from top to bottom (-5 to 5)
            globeRef.current.material.uScanPos = Math.sin(t * 0.5) * 5.5;
            globeRef.current.rotation.y += 0.001;
        }
        if (trafficRef.current) trafficRef.current.material.uTime = t;
    });

    return (
        <group>
        <points ref={globeRef}>
            <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={globeCount} array={globePos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={globeCount} array={globeCol} itemSize={3} />
            </bufferGeometry>
            {/* @ts-ignore */}
            <cityGlobeMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexColors />
        </points>

        <points ref={trafficRef}>
            <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={trafficCount} array={trafficData.pos} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={trafficCount} array={trafficData.col} itemSize={3} />
            <bufferAttribute attach="attributes-aSpeed" count={trafficCount} array={trafficData.speeds} itemSize={1} />
            <bufferAttribute attach="attributes-aOffset" count={trafficCount} array={trafficData.offsets} itemSize={1} />
            <bufferAttribute attach="attributes-aAxis" count={trafficCount} array={trafficData.axes} itemSize={3} />
            </bufferGeometry>
            {/* @ts-ignore */}
            <trafficMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexColors />
        </points>
        </group>
    );
};