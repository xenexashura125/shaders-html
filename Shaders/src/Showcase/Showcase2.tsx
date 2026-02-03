import { useRef } from 'react'
import { extend, useFrame, type ThreeElement } from '@react-three/fiber'
import { OrbitControls, shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

const SlideMaterial = shaderMaterial(
    {
        uTime: 0,
        uTexture: new THREE.Texture(),
        uSize: 2.5,
        uColor1: new THREE.Color(0.65, 0.0, 0.0),
    },
    `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uSize;
        uniform float uTime;

        // REQUIRED FOR CLIPPING
        #include <clipping_planes_pars_vertex>

        void main() {
            vUv = uv;

            vec3 pos = position;
            pos.y += sin(pos.x * 10.0 + uTime) * 0.1;

            vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

            vec4 modelPos = modelMatrix * vec4(pos, 1.0);
            vec4 viewPos = viewMatrix * modelPos;

            vec4 clipPos = projectionMatrix * viewPos;

            // REQUIRED FOR CLIPPING
            #include <begin_vertex>
            #include <project_vertex>
            #include <clipping_planes_vertex>

            gl_Position =  clipPos;
            
            gl_PointSize = uSize * (10.0 / -viewPos.z);
        }
    `,
    `
        uniform vec3 uColor1;

        // REQUIRED FOR CLIPPING
        #include <clipping_planes_pars_fragment>

        void main() {
            // REQUIRED FOR CLIPPING
            #include <clipping_planes_fragment>

            gl_FragColor = vec4(uColor1, 1.0);
        }
    `
)

extend({ SlideMaterial })

declare module '@react-three/fiber' {
    interface ThreeElements {
        slideMaterial: ThreeElement<typeof SlideMaterial> & {
            uTime?: number
            uTexture?: THREE.Texture
            uSize?: number
            uColor1?: THREE.Color
        }
    }
}

const Scene = () => {
    const meshRef = useRef<THREE.Mesh>(null)
    const materialRef = useRef<THREE.ShaderMaterial>(null)

    const clipPlanes = [
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        new THREE.Plane(new THREE.Vector3(0, 0.3, 0), 0),
        new THREE.Plane(new THREE.Vector3(0, 0.1, 0), 0),
        // new THREE.Plane(new THREE.Vector3(0, 0, 1), 10),  
    ]

    useFrame((state, delta) => {

        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value += delta
        }
    })

    return (
        <>
            <points ref={meshRef}>
                <planeGeometry args={[10, 5, 100, 100]} />
                <slideMaterial
                    ref={materialRef}
                    clippingPlanes={clipPlanes}
                    clipShadows={true}
                    clipping={true}
                />
            </points>
        </>
    )
}

const Showcase2 = () => {
    return (
        <>
            <OrbitControls />
            <Scene />
        </>
    )
}

export default Showcase2