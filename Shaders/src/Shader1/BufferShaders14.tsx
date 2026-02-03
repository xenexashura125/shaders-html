import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';


export const BufferShaders14 = ({ gapFactor = 0.0, spacingMultiplier = 2, position = [0, 0, 0] }) => {
    const mesh = useRef<any>();
    // The initial desired count of particles for the main cloud
    const particleCount = 100000;
    // Number of additional star particles
    const starCount = 5000;

    // useMemo will recalculate the particles whenever gapFactor or spacingMultiplier changes.
    const { positions, colors, finalCount, starPositions, starColors, finalStarCount } = useMemo(() => {
        const resol = Math.max(2, Math.round(Math.cbrt(particleCount)));
        
        // --- Updated Spacing Calculation ---
        // The base spacing is multiplied by our new slider value.
        // This controls how spread out the individual points are.
        const spacing = (2 / resol) * spacingMultiplier;

        const posArr = [];
        const colArr = [];

        const starPosArr = [];
        const starColArr = [];

        const midpoint = (resol - 1) / 2;
        const gapThreshold = (resol * gapFactor) / 2;

        // Main particle cloud loop
        for (let z = 0; z < resol; z++) {
            for (let y = 0; y < resol; y++) {
                for (let x = 0; x < resol; x++) {

                    const isGapX = Math.abs(x - midpoint) < gapThreshold;
                    const isGapY = Math.abs(y - midpoint) < gapThreshold;
                    const isGapZ = Math.abs(z - midpoint) < gapThreshold;

                    if (isGapX && isGapZ && isGapY) {
                        continue;
                    }
                    
                    
                    let px = (x - midpoint) * spacing;
                    let py = (y - midpoint) * spacing;
                    let pz = (z - midpoint) * spacing;
                    
                    // Add small random perturbation for more natural distribution
                    px += (Math.random() - 0.5) * 0.05;
                    py += (Math.random() - 0.5) * 0.05;
                    pz += (Math.random() - 0.5) * 0.05;
                    
                    // params
                    const swirlStrength = 2.; // how much angle increases with r
                    const radialExponent = 2; // <1 expands near center, >1 compresses

                    const radius = Math.hypot(px * px, py * py, pz * pz);
                    const theta = Math.atan2(py, px);
                    const theta1 = Math.atan2(pz, px);
                    const theta2 = Math.atan2(py, pz);

                    const thetaPrime = (theta + theta1 + theta2) + radius * swirlStrength;      // angle + k * radius
                    const rPrime = Math.pow(radius, radialExponent);

                    const fx = rPrime * Math.cos(thetaPrime);
                    const fy = rPrime * Math.sin(thetaPrime);
                    const fz = pz + rPrime * Math.cos(thetaPrime) / (Math.PI / 2); // keep z linear (or modify)
                    posArr.push(fx, fy, fz);


                    // Adjusted colors for more Milky Way-like appearance (blues, purples, whites)
                    const t = (Math.sin(radius * 5) + 1) / 2; // Use sinusoidal variation based on radius for banding
                    let r = 0.4 + 0.3 * t + (Math.random() - 0.5) * 0.1;
                    let g = 0.5 + 0.2 * (1 - t) + (Math.random() - 0.5) * 0.1;
                    let b = 0.7 + 0.3 * (0.5 + 0.5 * (1 - t)) + (Math.random() - 0.5) * 0.1;
                    
                    // Clamp colors to 0-1
                    r = Math.max(0, Math.min(1, r));
                    g = Math.max(0, Math.min(1, g));
                    b = Math.max(0, Math.min(1, b));

                    colArr.push(r, g, b);
                }
            }
        }
        
        const actualCount = posArr.length / 3;

        // Additional random stars within the galaxy structure
        for (let i = 0; i < starCount; i++) {
            // Random positions in the resolution space
            const x = Math.random() * resol;
            const y = Math.random() * resol;
            const z = Math.random() * resol;

            // Apply similar gap check for stars to keep them in the galaxy arms
            const isGapX = Math.abs(x - midpoint) < gapThreshold;
            const isGapY = Math.abs(y - midpoint) < gapThreshold;
            const isGapZ = Math.abs(z - midpoint) < gapThreshold;

            if (isGapX && isGapZ && isGapY) {
                continue; // Skip if in the central gap
            }

            let px = (x - midpoint) * spacing;
            let py = (y - midpoint) * spacing;
            let pz = (z - midpoint) * spacing;

            const swirlStrength = 2.; // how much angle increases with r
            const radialExponent = 2; // <1 expands near center, >1 compresses


            // Smaller perturbation for stars
            px += (Math.random() - 0.5) * 0.02;
            py += (Math.random() - 0.5) * 0.02;
            pz += (Math.random() - 0.5) * 0.02;

            // Same transformation as main particles
            const radius = Math.hypot(px * px , py * py, pz * pz);
            const theta = Math.atan2(py, px);
            const theta1 = Math.atan2(pz, px);
            const theta2 = Math.atan2(py, pz);

            const thetaPrime = (theta + theta1 + theta2) + radius * swirlStrength;
            const rPrime = Math.pow(radius, radialExponent);

            const fx = rPrime * Math.cos(thetaPrime);
            const fy = rPrime * Math.sin(thetaPrime);
            const fz = pz + rPrime * Math.cos(thetaPrime) / (Math.PI / 2);
            starPosArr.push(fx, fy, fz);

            // Star colors: mostly white/yellowish for bright stars, with some variation
            const starT = Math.random();
            let sr = 1.0 - 0.2 * starT;
            let sg = 1.0 - 0.1 * starT;
            let sb = 0.8 - 0.3 * starT;

            starColArr.push(sr, sg, sb);
        }

        const actualStarCount = starPosArr.length / 3;

        return {
            positions: new Float32Array(posArr),
            colors: new Float32Array(colArr),
            finalCount: actualCount,
            starPositions: new Float32Array(starPosArr),
            starColors: new Float32Array(starColArr),
            finalStarCount: actualStarCount,
        };
    }, [gapFactor, spacingMultiplier]); // Re-run when either slider changes

    // A unique key ensures the geometry is fully recreated when its properties change
    const uniqueKey = `${gapFactor}-${spacingMultiplier}`;

    return (
        <group position={position}>
            <points ref={mesh}>
                <bufferGeometry key={uniqueKey}>
                    <bufferAttribute
                        attach={"attributes-position"}
                        count={finalCount}
                        array={positions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={finalCount}
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
            <points>
                <bufferGeometry key={`stars-${uniqueKey}`}>
                    <bufferAttribute
                        attach={"attributes-position"}
                        count={finalStarCount}
                        array={starPositions}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={finalStarCount}
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
