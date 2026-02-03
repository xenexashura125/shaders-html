import { shaderMaterial } from '@react-three/drei'
import { extend, useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

// Vertex Shader
// Standard 3D transformation and passing necessary vectors to fragment shader
const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewBone;
    varying vec2 vUv;

    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewBone = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
    }
`
// const vertexShader = `
//     varying vec3 vNormal;
//     varying vec3 vViewDir;
//     varying vec2 vUv;
//     varying vec3 vWorldNormal;

//     void main() {
//         vUv = uv;
//         vNormal = normalize(normalMatrix * normal);
//         vWorldNormal = normalize(normal); // Fixed to object space (no view rotation)
//         vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
//         vViewDir = normalize(-mvPosition.xyz);
//         gl_Position = projectionMatrix * mvPosition;
//     }
// `

// Fragment Shader
// Implements Fresnel effect for glass-like transparency
const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFresnelBias;
    uniform float uFresnelScale;
    uniform float uFresnelPower;
    varying vec2 vUv; // Use vUv for pixel pattern

    varying vec3 vNormal;
    varying vec3 vViewBone;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewBone);

        // Generalized Schlick Fresnel
        // float NdotV = max(0.0, dot(viewDir, normal) * dot(viewDir, normal) * length(vec3(sin(uTime * 0.25))) );
        // NdotV *= sin(uTime * 0.25) * cos(dot(viewDir, normal * uTime));
        float NdotV = max(0.0, dot(viewDir, normal));
        float fresnel = uFresnelBias + uFresnelScale * pow(1.0 - NdotV, uFresnelPower);
        fresnel = clamp(fresnel * sin(uTime * fresnel * 0.5), 0.0, 1.0);

        // Pixelated Grid / Gaps Effect
        float pixelScale = 5.0;
        float moveSpeed = 0.5;
        vec2 gridUv = vUv * pixelScale + vec2(uTime * moveSpeed, uTime * moveSpeed * 0.5);
        // vec2 gridPos = fract(gridUv) * dot(cos(gridUv * 1.0 / uTime), sin(gridUv * uTime));
        vec2 gridPos = fract(gridUv);
        float gapThreshold = 0.05; // Size of the gaps
        float gridMask = smoothstep(gapThreshold, gapThreshold + 0.01,gridPos.x) * smoothstep(gapThreshold, gapThreshold + 0.01,gridPos.y);
        
        // Apply grid mask to fresnel/alpha
        // We keep the "glass" look but cut holes
        fresnel *= gridMask;

        // Rim light 
        vec3 rim = vec3(1.0) * pow(1.0 - NdotV, uFresnelPower + 2.0) * 0.5;
        // Also mask rim? Maybe or maybe not. Let's mask it for "gaps".
        rim *= gridMask;

        gl_FragColor = vec4(uColor + rim, fresnel);
    }
`

// const fragmentShader = `
//     uniform float uTime;
//     uniform vec3 uColor;
//     uniform float uFresnelBias;
//     uniform float uFresnelScale;
//     uniform float uFresnelPower;

//     varying vec2 vUv;
//     varying vec3 vNormal;
//     varying vec3 vViewDir;
//     varying vec3 vWorldNormal;

//     const float PI = 3.141592653589793;

//     void main() {
//         vec3 normal = normalize(vNormal);
//         vec3 viewDir = normalize(vViewDir);
//         float NdotV = max(0.0, dot(viewDir, normal));

//         // Generalized Schlick Fresnel
//         float fresnel = uFresnelBias + uFresnelScale * pow(1.0 - NdotV, uFresnelPower);
//         fresnel = clamp(fresnel, 0.0, 1.0);

//         // === Spherical Grid (Meridians + Parallels) ===
//         vec3 dir = normalize(vWorldNormal);

//         // Longitude (meridians - vertical lines)
//         float longitude = atan(dir.z, dir.x); // Fixed: atan(y, x) = atan2(y, x) in GLSL
//         float numMeridians = 48.0;           // More lines = finer grid
//         float lonSpeed = 0.12;               // Slightly faster rotation
//         float lonCoord = longitude / (2.0 * PI) * numMeridians + uTime * lonSpeed;
//         float lonFract = fract(lonCoord);
//         float lonDist = min(lonFract, 1.0 - lonFract);

//         // Latitude (parallels - horizontal lines)
//         float latitude = asin(dir.y);
//         float numParallels = 24.0;
//         float latSpeed = -0.06;              // Counter-rotation
//         float latNorm = (latitude + PI * 0.5) / PI; // 0.0 south → 1.0 north
//         float latCoord = latNorm * numParallels + uTime * latSpeed;
//         float latFract = fract(latCoord);
//         float latDist = min(latFract, 1.0 - latFract);

//         // Combined nearest line distance
//         float distToLine = min(lonDist, latDist);

//         // Grid parameters
//         float lineThickness = 0.04;   // Thinner, sharper transparent gaps
//         float softness = 0.035;       // Soft anti-aliased edges + subtle glow feel

//         // Mask: 1.0 = visible glass, 0.0 = transparent gap
//         float gridMask = smoothstep(lineThickness, lineThickness + softness, distToLine);

//         // Optional bright caustic-style glow inside the gaps (uncomment for extra magic)
//         // float lineGlow = 1.0 - smoothstep(lineThickness * 0.5, lineThickness + softness, distToLine);
//         // vec3 glowColor = vec3(0.7, 0.9, 1.0) * lineGlow * 0.9;

//         // Apply mask
//         fresnel *= gridMask;

//         // Rim light (masked for clean etched look)
//         vec3 rim = vec3(1.0) * pow(1.0 - NdotV, uFresnelPower + 2.0) * 0.6;
//         rim *= gridMask;
//         // rim += glowColor; // Uncomment with glow above

//         gl_FragColor = vec4(uColor + rim, fresnel);
//     }
// `

const GlassMaterial = shaderMaterial(
  { 
    uTime: 0,
    uColor: new THREE.Color(0.1, 0.2, 0.3),
    uFresnelBias: 0.0,
    uFresnelScale: 0.0,
    uFresnelPower: 0.0,
  },
  vertexShader,
  fragmentShader
)

extend({ GlassMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    glassMaterial: any
  }
}

export const SphereShade = () => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const materialRef = useRef<any>(null!)

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uTime = clock.getElapsedTime()
    }
    // Slowly rotate the sphere for effect
    if (meshRef.current) {
       meshRef.current.rotation.y = clock.getElapsedTime() * 0.1
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 128, 128]} />
      <glassMaterial 
        ref={materialRef} 
        transparent={true} 
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uFresnelBias={0.1}
        uFresnelScale={0.9}
        uFresnelPower={2.5}
        uColor={new THREE.Color(0.1, 0.2, 0.3)}
      />
    </mesh>
  )
}