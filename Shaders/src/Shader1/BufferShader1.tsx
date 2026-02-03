import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useControls } from "leva";

// --- ATTRACTOR EQUATIONS ---
const attractors = {
  lorenz: (x, y, z, { sigma, rho, beta }) => [
    sigma * (y - x),
    x * (rho - z) - y,
    x * y - beta * z,
  ],
  aizawa: (x, y, z, { a, b, c, d, e, f }) => [
    (z - b) * x - d * y,
    d * x + (z - b) * y,
    c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x,
  ],
  thomas: (x, y, z, { b }) => [
    Math.sin(y) - b * x,
    Math.sin(z) - b * y,
    Math.sin(x) - b * z,
  ],
  dadras: (x, y, z, { a, b, c, d, e }) => [
    y - a * x + b * y * z,
    c * y - x * z + z,
    d * x * y - e * z,
  ],
  chen: (x, y, z, { a, b, c }) => [
    a * (y - x),
    (c - a) * x - x * z + c * y,
    x * y - b * z,
  ],
};

// --- DEFAULT PARAMS FOR EACH ATTRACTOR ---
const defaultParams = {
  lorenz: { sigma: 10, rho: 28, beta: 8 / 3, scale: 0.5, speed: 1 },
  aizawa: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, scale: 15, speed: 2 },
  thomas: { b: 0.2, scale: 4, speed: 1.5 },
  dadras: { a: 3, b: 2.7, c: 1.7, d: 2, e: 9, scale: 2.5, speed: 0.5 },
  chen: { a: 40, b: 3, c: 28, scale: 1.0, speed: 0.8 },
};

export const BufferShader1 = () => {
    // --- LEVA CONTROLS ---
    const {
        attractor,
        particleCount,
        particleSize,
        opacity,
        colorA,
        colorB,
        speedMultiplier,
        rotationSpeed,
        bloomIntensity,
        bloomThreshold,
        bloomRadius
    } = useControls("Attractor Settings", {
        attractor: {
            value: "lorenz",
            options: ["lorenz", "aizawa", "thomas", "dadras", "chen"],
        },
        particleCount: { value: 200000, min: 10000, max: 1000000, step: 10000 },
        particleSize: { value: 0.03, min: 0.001, max: 0.2, step: 0.001 },
        opacity: { value: 0.6, min: 0.1, max: 1.0, step: 0.05 },
        colorA: "#ff0055", // Hot pink
        colorB: "#00aaff", // Cyan
        speedMultiplier: { value: 1.0, min: 0.1, max: 5.0, step: 0.1 },
        rotationSpeed: { value: 0.1, min: 0, max: 1, step: 0.01 },
        bloomIntensity: { value: 1.5, min: 0, max: 5 },
        bloomThreshold: { value: 0.2, min: 0, max: 1 },
        bloomRadius: { value: 0.5, min: 0, max: 1 },
    });

    const groupRef = useRef();
    const meshRef = useRef();

    // --- GEOMETRY DATA ---
    // We use useMemo to regenerate only when count changes.
    // However, positions update every frame. We need stable buffers.
    const { positions, colors } = useMemo(() => {
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);

        // Initial random positions
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
        }

        return { positions, colors };
    }, [particleCount]);

    // Current state arrays (x, y, z) for integration logic
    // We don't put these in attribute buffers directly to avoid read-back overhead if possible,
    // but here we just write directly to the positions buffer each frame.
    // For integration, we need the *previous* step values.
    // Since we write to positions array in place, we effectively have them.
    // But for higher precision or cleaner math, let's keep a separate reference for simulation state
    // if we wanted to be pure. For visual chaos, modifying in place is often fine or we use a temporary variable.

    // Let's use a ref to store the current simulation coordinates to avoid reading from the buffer array repeatedly
    // and to allow for potentially higher precision than Float32 if needed (though JS numbers are doubles).
    const simulationData = useMemo(() => {
        return new Float32Array(particleCount * 3).map(() => (Math.random() - 0.5) * 10);
    }, [particleCount]);


    // Helper for Color interpolation
    const cA = new THREE.Color(colorA);
    const cB = new THREE.Color(colorB);
    const tempColor = new THREE.Color();

    useFrame((state, delta) => {
        const params = defaultParams[attractor];
        const dt = 0.01 * speedMultiplier * params.speed;
        const scale = params.scale;

        const positionsArray = meshRef.current.geometry.attributes.position.array;
        const colorsArray = meshRef.current.geometry.attributes.color.array;

        // Attractor function
        const getDelta = attractors[attractor];

        // Safety check
        if (!getDelta) return;

        // Iterate particles
        for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;

            let x = simulationData[ix];
            let y = simulationData[iy];
            let z = simulationData[iz];

            // Integrate
            const [dx, dy, dz] = getDelta(x, y, z, params);

            x += dx * dt;
            y += dy * dt;
            z += dz * dt;

            // Reset loop for particles that escape or get stuck (simple bounds check)
            // Some attractors are bounded, but numerical instability can shoot particles off.
            const distSq = x * x + y * y + z * z;
            if (distSq > 40000 || isNaN(distSq)) {
                 x = (Math.random() - 0.5) * 10;
                 y = (Math.random() - 0.5) * 10;
                 z = (Math.random() - 0.5) * 10;
            }

            simulationData[ix] = x;
            simulationData[iy] = y;
            simulationData[iz] = z;

            // Update visible positionbuffer
            positionsArray[ix] = x * scale;
            positionsArray[iy] = y * scale;
            positionsArray[iz] = z * scale;

            // Update color based on velocity or position
            // Let's use velocity magnitude for a nice gradient
            const speed = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // Normalize speed roughly for visual interest. Lorenz varies from 0 to ~50.
            let t = Math.min(speed / 40, 1.0); 
            
            // Simple Lerp
            tempColor.lerpColors(cB, cA, t);
            
            colorsArray[ix] = tempColor.r;
            colorsArray[iy] = tempColor.g;
            colorsArray[iz] = tempColor.b;
        }

        meshRef.current.geometry.attributes.position.needsUpdate = true;
        meshRef.current.geometry.attributes.color.needsUpdate = true;
        
        // Auto Rotate
        if (groupRef.current) {
            groupRef.current.rotation.y += rotationSpeed * delta;
        }
    });

    return (
        <>
            <group ref={groupRef}>
                <points ref={meshRef}>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={positions.length / 3}
                            array={positions}
                            itemSize={3}
                        />
                        <bufferAttribute
                            attach="attributes-color"
                            count={colors.length / 3}
                            array={colors}
                            itemSize={3}
                        />
                    </bufferGeometry>
                    <pointsMaterial
                        size={particleSize}
                        vertexColors
                        transparent
                        opacity={opacity}
                        sizeAttenuation
                        depthWrite={false}
                        blending={THREE.AdditiveBlending}
                    />
                </points>
            </group>
            
            <EffectComposer>
                <Bloom 
                    luminanceThreshold={bloomThreshold} 
                    luminanceSmoothing={0.9} 
                    intensity={bloomIntensity} 
                    radius={bloomRadius}
                />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
        </>
    );
};