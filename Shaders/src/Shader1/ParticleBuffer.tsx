import { OrbitControls, shaderMaterial } from '@react-three/drei';
import { Canvas, extend, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

// 1. Define a Custom Shader Material
const ParticleMaterial = shaderMaterial(
  {
    uTime: 0,
    uSize: 100.0,
  },
  // Vertex Shader: Handles movement and "breathing"
  `
  varying vec3 vColor;
  uniform float uTime;
  uniform float uSize;

  void main() {
    vColor = color;
    vec3 pos = position;

    // Artistic Movement: Subtle vortex & breathing
    float angle = atan(pos.z, pos.x);
    float dist = length(pos.xz) * dot(pos.x, pos.z) - sin(uTime * length(pos.xz));
    
    // Make it "breathe" - pulsing the radius
    float wave = sin(uTime * 0.5 + dist * 0.5) * 10.;
    pos.x += cos(angle) * wave / (atan(wave) + 1.0);
    pos.z += sin(angle) * wave / (atan(wave) + 1.0);

    // Spiral lift
    pos.y += sin(uTime * 0.2 + dist) * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (1.0 / -mvPosition.z); // Size attenuation
    gl_Position = projectionMatrix * mvPosition;
  }
  `,
  // Fragment Shader: Makes particles look like soft glowing orbs
  `
  varying vec3 vColor;
  void main() {
    // Turn square points into soft circles
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    gl_FragColor = vec4(vColor, alpha * 0.8);
  }
  `
);

extend({ ParticleMaterial });

export const ParticleBuffer = () => {
  const mesh = useRef();
  const count = 300000;

  // Generate initial positions and colors once (Performance win!)
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorA = new THREE.Color("#4400ff"); // Deep Electric Blue
    const colorB = new THREE.Color("#ff00dd"); // Neon Pink

    for (let i = 0; i < count; i++) {
      // Your flower math (Simplified for the demo)
      const angle = Math.random() * Math.PI * 2;
      const layer = Math.floor(Math.random() * 5);
      const radius = (Math.sin(angle * (layer + 2)) + 2) * Math.random() * 5;
      
      pos[i * 3 + 0] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 2;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      // Color gradient based on distance from center
      const mixedColor = colorA.clone().lerp(colorB, radius / 10);
      col[i * 3 + 0] = mixedColor.r;
      col[i * 3 + 1] = mixedColor.g;
      col[i * 3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, []);

  useFrame((state) => {
    if (mesh.current) {
      // Update the uTime uniform to drive animations
      mesh.current.material.uTime = state.clock.getElapsedTime();
      mesh.current.rotation.y += 0.001;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      {/* @ts-ignore */}
      <particleMaterial 
        transparent 
        depthWrite={false} 
        blending={THREE.AdditiveBlending} 
        vertexColors 
      />
    </points>
  );
};