import React, { useEffect, useRef } from 'react'
import { useFrame, extend, useThree, type ThreeElement } from '@react-three/fiber'
import { shaderMaterial, OrbitControls, Environment } from '@react-three/drei'
import * as THREE from 'three'
import { DoubleSide } from 'three'

// Define the custom shader material
const ColorShiftMaterial = shaderMaterial(
    {
        uTime: 0,
        uColor1: new THREE.Color(1.0, 1.0, 1.0), // White
        uColor2: new THREE.Color(1.0, 0.4, 0.4), // Medium/Light Red
        uSize: 2.5,
        uMouse: new THREE.Vector3(-999, -999, -999),
        uBulgeHeight: 2.0,
        uBulgeDirection: 1.0,
    },
    // Vertex Shader
    `
        uniform float uTime;
        uniform float uSize;
        uniform float uBulgeDirection;
        uniform vec3 uMouse;
        uniform float uBulgeHeight;
        
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vStrength;

        void main() {
            vUv = uv;
            
            vec3 pos = position;
            
            // Small wave for dynamic feel
            float wave = sin(pos.x * 0.75 + uTime) * 0.15;
            float wave2 = sin(pos.z * 0.75 + uTime) * 0.15;
            pos.z += wave + wave2;
            
            vec3 preTwistPos = pos;

            // Plane-local XZ approximation using local coordinates (matches world XZ after rotation)
            vec2 worldXZ = vec2(preTwistPos.x, -preTwistPos.y);
            vec2 centerXZ = uMouse.xz;
            
            float radius = 4.0; 
            float strength = 0.0;

            vec2 diff = worldXZ - centerXZ;
            float dist = length(diff);

            if (dist < radius) {
                strength = 1.0 - smoothstep(0.0, radius, dist);
            }

            // Pass strength to fragment for consistent coloring
            vStrength = strength;

            // Twist effect
            if (strength > 0.0) {
                float angle = strength* uBulgeHeight * uBulgeDirection;
                
                float c = cos(angle);
                float s = sin(angle);
                
                vec2 vecFromCenter = worldXZ - centerXZ;
                vec2 rotatedVec = vec2(
                    vecFromCenter.x * c - vecFromCenter.y * s,
                    vecFromCenter.x * s + vecFromCenter.y * c
                );
                
                vec2 newWorldXZ = centerXZ + rotatedVec;
                
                pos.x = newWorldXZ.x;
                pos.y = -newWorldXZ.y;
            }

            vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPosition.xyz;

            vec4 mvPosition = viewMatrix * worldPosition;
            gl_Position = projectionMatrix * mvPosition;
            
            gl_PointSize = uSize * (20.0 / -mvPosition.z);
        }
    `,
    // Fragment Shader
    `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uMouse;
        
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vStrength;

        void main() {
            // Base waving color mix
            float wave = sin(vUv.x * 5.0 + uTime) * 0.5 + 0.5;
            float wave2 = cos(vUv.y * 5.0 + uTime * 2.0) * 0.5 + 0.5;
            float strength = (wave + wave2) * 0.5;
            
            vec3 finalColor = mix(uColor1, uColor2, strength);

            // Interaction highlight using strength passed from vertex (cheaper + consistent with deformation)
            float fade = vStrength;
            if (fade > 0.0) {
                float colorT = 1.0 - fade;
                vec3 highlightColor = mix(vec3(0.15, 0.0, 0.15), vec3(1.0, 0.25, 0.3), colorT);
                finalColor = mix(finalColor, highlightColor, fade);
            }
            
            // Round points
            vec2 coord = gl_PointCoord - vec2(0.5);
            if (length(coord) > 0.5) discard;
            
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
)

extend({ ColorShiftMaterial })

declare module '@react-three/fiber' {
    interface ThreeElements {
        colorShiftMaterial: ThreeElement<typeof ColorShiftMaterial> & {
            uTime?: number
            uColor1?: THREE.Color
            uColor2?: THREE.Color
            uSize?: number
            uMouse?: THREE.Vector3,
            uBulgeHeight?: number,
            uBulgeDirection?: number,
            // cameraPosition?: THREE.Vector3
        }
    }
}

const Scene = () => {
    const materialRef = useRef<THREE.ShaderMaterial>(null!)
    const geometryRef = useRef<THREE.BufferGeometry>(null!)
    const proxyGeometryRef = useRef<THREE.BufferGeometry>(null!)

    const { camera } = useThree()

    // Shared bending logic
    const bendGeometry = (geo: THREE.BufferGeometry | null) => {
        if (!geo) return
        const posAttribute = geo.attributes.position
        const count = posAttribute.count
        const T = 3

        for (let i = 0; i < count; i++) {
            const y = posAttribute.getY(i)
            let z = posAttribute.getZ(i)

            if (y > T) {
                z += y - 0.5 * T
            } else if (y > 0.0) {
                z += 0.5 * y * y / T
            }

            posAttribute.setZ(i, z)
        }
        posAttribute.needsUpdate = true
        geo.computeBoundingBox()
        geo.computeBoundingSphere()
    }

    useEffect(() => {
        bendGeometry(geometryRef.current)
        bendGeometry(proxyGeometryRef.current)
    }, [])

    useFrame((state, delta) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value += delta
        }
    })

    const onPointerMove = (e: any) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uMouse.value.copy(e.point)
        }
    }

    const onPointerOut = () => {
        if (materialRef.current) {
            materialRef.current.uniforms.uMouse.value.set(-999, -999, -999)
        }
    }

    return (
        <>
            <fogExp2 attach="fog" args={['#fd8b8b', 0.15]} />
            <OrbitControls />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <Environment preset="city" />

            {/* Invisible low-poly proxy mesh for fast, accurate raycasting/picking */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.25, 0]}
                onPointerMove={onPointerMove}
                onPointerOut={onPointerOut}
            >
                <planeGeometry ref={proxyGeometryRef} args={[60, 20, 192, 64]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
            </mesh>

            {/* High-resolution points for the pixelated visual (no pointer events - proxy handles them) */}
            <points rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
                <planeGeometry ref={geometryRef} args={[60, 20, 256, 256]} />
                <colorShiftMaterial ref={materialRef} transparent />
            </points>
        </>
    )
}

const Showcase1 = () => {
    return <Scene />
}

export default Showcase1