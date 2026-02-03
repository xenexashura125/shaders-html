import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';


export const StrangeAttractor = ({ gapFactor = 0.0, spacingMultiplier = 2, position = [0, 0, 0] }) => {
    const groupRef = useRef<any>();
    const pointsRef = useRef<any>();
    const starsRef = useRef<any>();
    // The initial desired count of particles for the main cloud
    const particleCount = 300000;
    // Number of additional star particles
    const starCount = 5000;

    // Lorenz attractor parameters
    const sigma = 10;
    const rho = 28;
    const beta = 8 / 5;
    const dt = 0.0086; // Step size for integration

    // Scale the attractor; updates when spacingMultiplier changes
    const scale = spacingMultiplier / 10;

    // Refs for dynamic positions and states
    const positionsRef = useRef(new Float32Array(particleCount * 3));
    const xsRef = useRef(new Float32Array(particleCount));
    const ysRef = useRef(new Float32Array(particleCount));
    const zsRef = useRef(new Float32Array(particleCount));

    const starPositionsRef = useRef(new Float32Array(starCount * 3));
    const starXsRef = useRef(new Float32Array(starCount));
    const starYsRef = useRef(new Float32Array(starCount));
    const starZsRef = useRef(new Float32Array(starCount));

    // Colors are static, computed once (or recompute if needed)
    const colors = useMemo(() => {
        const colArr = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            // Randomize t for varied colors
            const t = Math.random();
            let r = 0.4 + 0.3 * t + (Math.random() - 0.5) * 0.1;
            let g = 0.5 + 0.2 * (1 - t) + (Math.random() - 0.5) * 0.1;
            let b = 0.7 + 0.3 * (0.5 + 0.5 * (1 - t)) + (Math.random() - 0.5) * 0.1;
            
            // Clamp colors to 0-1
            r = Math.max(0, Math.min(1, r));
            g = Math.max(0, Math.min(1, g));
            b = Math.max(0, Math.min(1, b));

            colArr[i * 3] = r;
            colArr[i * 3 + 1] = g;
            colArr[i * 3 + 2] = b;
        }
        return colArr;
    }, []); // No dependencies, colors fixed

    const starColors = useMemo(() => {
        const starColArr = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const starT = Math.random();
            let sr = 1.0 - 0.2 * starT;
            let sg = 1.0 - 0.1 * starT;
            let sb = 0.8 - 0.3 * starT;

            starColArr[i * 3] = sr;
            starColArr[i * 3 + 1] = sg;
            starColArr[i * 3 + 2] = sb;
        }
        return starColArr;
    }, []);

    // Initialize or reset positions when gapFactor or spacingMultiplier changes
    useEffect(() => {
        // Initialize main particles randomly in a box around the attractor
        for (let i = 0; i < particleCount; i++) {
            xsRef.current[i] = (Math.random() - 0.5) * 40;
            ysRef.current[i] = (Math.random() - 0.5) * 50;
            zsRef.current[i] = Math.random() * 50;

            // Set initial positions
            positionsRef.current[i * 3] = xsRef.current[i] * scale;
            positionsRef.current[i * 3 + 1] = ysRef.current[i] * scale;
            positionsRef.current[i * 3 + 2] = (zsRef.current[i] - 25) * scale; // Center z
        }

        // Initialize stars similarly, with slight variation
        const starRho = 28.5; // Not used here, but could vary params if wanted
        for (let i = 0; i < starCount; i++) {
            starXsRef.current[i] = (Math.random() - 0.5) * 40 + (Math.random() - 0.5); // Small offset
            starYsRef.current[i] = (Math.random() - 0.5) * 50 + (Math.random() - 0.5);
            starZsRef.current[i] = Math.random() * 50 + (Math.random() - 0.5);

            starPositionsRef.current[i * 3] = starXsRef.current[i] * scale + (Math.random() - 0.5) * 0.02;
            starPositionsRef.current[i * 3 + 1] = starYsRef.current[i] * scale + (Math.random() - 0.5) * 0.02;
            starPositionsRef.current[i * 3 + 2] = (starZsRef.current[i] - 25) * scale + (Math.random() - 0.5) * 0.02;
        }
    }, [gapFactor, spacingMultiplier, scale]); // Reset on changes

    // Animate: update positions based on Lorenz equations and rotate group
    useFrame(() => {
        // Update main particles
        for (let i = 0; i < particleCount; i++) {
            const x = xsRef.current[i];
            const y = ysRef.current[i];
            const z = zsRef.current[i];

            const dx = sigma * (y - x);
            const dy = x * (rho - z) - y;
            const dz = x * y - beta * z;

            xsRef.current[i] += dx * dt;
            ysRef.current[i] += dy * dt;
            zsRef.current[i] += dz * dt;

            // Apply gapFactor: if too close to center, reset to random position
            const radius = Math.hypot(xsRef.current[i], ysRef.current[i], zsRef.current[i]);
            if (radius < gapFactor * 10) {
                xsRef.current[i] = (Math.random() - 0.5) * 40;
                ysRef.current[i] = (Math.random() - 0.5) * 50;
                zsRef.current[i] = Math.random() * 50;
            }

            positionsRef.current[i * 3] = xsRef.current[i] * scale;
            positionsRef.current[i * 3 + 1] = ysRef.current[i] * scale;
            positionsRef.current[i * 3 + 2] = (zsRef.current[i] - 25) * scale;
        }

        // Update star particles (similar, with starRho for variation)
        const starRho = 28.5;
        for (let i = 0; i < starCount; i++) {
            const sx = starXsRef.current[i];
            const sy = starYsRef.current[i];
            const sz = starZsRef.current[i];

            const dx = sigma * (sy - sx);
            const dy = sx * (starRho - sz) - sy;
            const dz = sx * sy - beta * sz;

            starXsRef.current[i] += dx * dt * dx;
            starYsRef.current[i] += dy * dt * dy;
            starZsRef.current[i] += dz * dt * dz;

            const starRadius = Math.hypot(starXsRef.current[i], starYsRef.current[i], starZsRef.current[i]);
            if (starRadius < gapFactor * 10) {
                starXsRef.current[i] = (Math.random() - 0.5) * 40;
                starYsRef.current[i] = (Math.random() - 0.5) * 50;
                starZsRef.current[i] = Math.random() * 50;
            }

            starPositionsRef.current[i * 3] = starXsRef.current[i] * scale + (Math.random() - 0.5) * 0.02;
            starPositionsRef.current[i * 3 + 1] = starYsRef.current[i] * scale + (Math.random() - 0.5) * 0.02;
            starPositionsRef.current[i * 3 + 2] = (starZsRef.current[i] - 25) * scale + (Math.random() - 0.5) * 0.02;
        }

        // Flag positions as updated
        if (pointsRef.current) {
            pointsRef.current.geometry.attributes.position.needsUpdate = true;
        }
        if (starsRef.current) {
            starsRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // Slowly rotate the group for additional viewing dynamics
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.005; // Increased speed for more noticeable rotation
        }
    });

    // A unique key ensures the geometry is recreated if needed, but since dynamic, less relevant
    const uniqueKey = `${gapFactor}-${spacingMultiplier}`;

    return (
        <group ref={groupRef} position={position}>
            <points ref={pointsRef}>
                <bufferGeometry key={uniqueKey}>
                    <bufferAttribute
                        attach={"attributes-position"}
                        count={particleCount}
                        array={positionsRef.current}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={particleCount}
                        array={colors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    size={0.015} // Slightly smaller for main cloud
                    sizeAttenuation
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    transparent
                    opacity={0.8} // Slight transparency for better blending
                />
            </points>
            {/* Separate points for stars */}
            <points ref={starsRef}>
                <bufferGeometry key={`stars-${uniqueKey}`}>
                    <bufferAttribute
                        attach={"attributes-position"}
                        count={starCount}
                        array={starPositionsRef.current}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={starCount}
                        array={starColors}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    vertexColors
                    size={0.05} // Larger size for stars
                    sizeAttenuation
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    transparent
                    opacity={1.0}
                />
            </points>
        </group>
    );

}