import { useEffect, useRef } from 'react'
import { extend, useFrame, type ThreeElement } from '@react-three/fiber'
import { OrbitControls, shaderMaterial, useTexture } from '@react-three/drei'
import * as THREE from 'three'

import img from '../assets/Sigma2.jpg'

const SlideMaterial = shaderMaterial(
    {
        uTexture: null,
        uSize: 2.0, // Increased a bit for better fill/gaps at default zoom
        uRevealProgress: 0,
        uAspect: 1.0,
    },
    // Vertex shader
    `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vAppear;

        uniform sampler2D uTexture;
        uniform float uAspect;
        uniform float uSize;
        uniform float uRevealProgress;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
        }
            
        float easeOutExpo(float t) {
            return (t >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t));
        }

        void main() {
            vUv = uv;

            // Flip Y if needed for your texture orientation
            vec2 sampleUv = vec2(vUv.x, 1.0 - vUv.y);
            vec4 texColor = texture2D(uTexture, sampleUv);
            vColor = texColor.rgb;

            // Pseudo-random value per point (0–1)
            // float random = hash(vUv * 123.45);

            // Staggered appear: each point starts revealing at different progress
            // Over ~0.2 progress units for soft fade/grow per point (adjust for faster/slower individual pops)
            // vAppear = clamp((uRevealProgress - random) / 0.000001, 0.0, 1.0);

            // Replace the random + vAppear block with this
            // float delay = vUv.x * 0.3;         // start from left (0) to right (0.8)
            // float duration = 0.25;             // width of the soft band
            // vAppear = smoothstep(delay, delay + duration, uRevealProgress);

            // float delay = vUv.x * 1.2;        // scale >1.0 so reveal uses full animation time + overrun
            // float duration = 0.06;            // small = very sharp pop (0.03 = almost instant, 0.1 = quick linear grow)
            // vAppear = clamp((uRevealProgress - delay) / duration, 0.0, 1.0);



            // Normalized distance from center (perfect circle with aspect correction)
            float normalizedDist = length(position.xy / vec2(uAspect, 1.0)) / 100.;

            // Stagger by distance (center first)
            float delay = normalizedDist;                // 0 at center, ~1 at edges
            float duration = 0.5;                       // ring width/speed (0.1 = sharp/fast, 0.4 = softer/slower)
            float t = smoothstep((uRevealProgress - delay) / duration, 0.0, 1.0);

            float appear = easeOutExpo(t);

            vAppear = appear;

            vec3 animatedPos = position * appear;

            // vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
            vec4 mvPosition = viewMatrix * modelMatrix * vec4(animatedPos, 1.0);

            gl_Position = projectionMatrix * mvPosition;

            // Larger attenuation constant for better perceived size/density at default camera distance
            float baseSize = uSize * (10.0 / -mvPosition.z);
            gl_PointSize = baseSize * vAppear;
        }
    `,
    // Fragment shader — soft round points + reveal fade
    `
        varying vec3 vColor;
        varying float vAppear;

        void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);

            // Soft round mask (full opacity in center, soft falloff to edges)
            // float pointAlpha = 1.0 - smoothstep(0.0, 0.5, dist);
            if (dist > 0.5) discard; // Hard round
            float alpha = 1.0 - smoothstep(0.4, 0.5, dist);

            gl_FragColor = vec4(vColor, alpha * vAppear);
        }
    

    `
)

extend({ SlideMaterial })

declare module '@react-three/fiber' {
    interface ThreeElements {
        slideMaterial: ThreeElement<typeof SlideMaterial> & {
            uTexture?: THREE.Texture
            uSize?: number
            uRevealProgress?: number
        }
    }
}

const Scene = () => {
    const pointsRef = useRef<THREE.Points>(null!)
    const materialRef = useRef<any>(null)
    const progressRef = useRef(0)

    const texture = useTexture(img)

    texture.magFilter = THREE.NearestFilter
    texture.minFilter = THREE.NearestFilter
    texture.generateMipmaps = false

    useEffect(() => {
        if (materialRef.current && texture.image && pointsRef.current) {
            const img = texture.image as HTMLImageElement
            const w = img.naturalWidth || img.width
            const h = img.naturalHeight || img.height
            if (w && h) {
                const aspect = w / h
                pointsRef.current.scale.x = aspect / 2.0 // Preserve full original aspect
                materialRef.current.uniforms.uAspect.value = w / h
                materialRef.current.uniforms.uTexture.value = texture
                materialRef.current.needsUpdate = true
            }
        }
    }, [texture])

    useFrame((_, delta) => {
        progressRef.current += delta * 0.3 // Adjust speed here (higher = faster reveal)

        if (materialRef.current) {
            materialRef.current.uniforms.uRevealProgress.value = Math.min(1.0, progressRef.current)
        }
    })

    return (
        <>
            <points ref={pointsRef}>
                <planeGeometry args={[10, 5, 256, 256]} />
                <slideMaterial
                    ref={materialRef}
                    // transparent={true}
                    depthWrite={false}
                    blending={THREE.NormalBlending} // Glowy build-up — switch to NormalBlending if too bright
                />
            </points>
        </>
    )
}

const Showcase3 = () => {
    return (
        <>
            <OrbitControls />
            <Scene />
        </>
    )
}

export default Showcase3