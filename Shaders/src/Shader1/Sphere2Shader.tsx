import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export const Sphere2Shader = () => {
  const meshRef = useRef<THREE.Mesh>(null!)
  const hoverValue = useRef(0)

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_hover: { value: 0 },
    }),
    []
  )

  useFrame((state) => {
    const { clock, size } = state
    uniforms.u_time.value = clock.getElapsedTime()
    // Reset to full resolution for correct calculations
    uniforms.u_resolution.value.set(size.width / 2, size.height / 2)
    
    // Smooth lerp for the hover effect
    uniforms.u_hover.value = THREE.MathUtils.lerp(
      uniforms.u_hover.value,
      hoverValue.current,
      0.08 // Slightly snappier response
    )
  })

  // Vertex shader
  const vertexShader = /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  // Fragment shader - Premium "Sci-Fi Singularity" Edition
  const fragmentShader = /* glsl */ `
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_hover;
    
    // --- Helpers ---
    vec4 tanh_fit(vec4 x) {
      vec4 ex = exp(x);
      vec4 emx = exp(-x);
      return (ex - emx) / (ex + emx);
    }
    
    // Core "Eclipse" rendering logic
    // Returns the color for a given coordinate p
    vec3 getEclipse(vec2 p) {
        vec2 v = vec2(0.0);
        
        // Base structure
        float ringScale = 0.75; // The size of the ring
        float len = length(p);
        v += vec2(len - ringScale);
        
        // Hard clamping for the detailed noise structure
        vec2 max_v = max(v, -v * 10.0);
        float d1 = (0.05 + max_v).x;
        float d2 = 0.1 + abs(p.x - p.y);
        
        // Dynamic noise evolution
        // We add u_hover to speed up the "boiling" effect inside the core
        float t = u_time * (1.0 + 3.0 * u_hover); 
        vec4 numer = 0.03 * vec4(2.0, 1.0, 1.0 + p.x + sin(t)*0.01, 1.0 + p.y + cos(t)*0.01);
        
        return tanh_fit(numer / d1 / d2).rgb;
    }

    void main() {
      // 1. Normalized Coordinates
      vec2 r = u_resolution;
      vec2 p = (gl_FragCoord.xy * 2.0 - r ) / r.y;

      // Add near the top of main(), after the initial p calculation
      vec2 offset = vec2(3.0, 1.5);  // tweak these! e.g. vec2(0.05, -0.03)
      p -= offset;

      // 2. Space Warping (Fish-eye / Gravity Lens)
      // On hover, we pull pixels in or push them out.
      // u_hover 0 -> 1.0 scale (normal)
      // u_hover 1 -> Distortion
      float len = length(p * p);
      float warp = 1.0 - 0.15 * u_hover * sin(len * 3.0 - u_time * 2.0);
      p *= warp;

      // 3. Chromatic Aberration (RGB Split)
      // We calculate the scene three times with slight offsets.
      float aberrationAmt = 0.03 * u_hover * (1.0 + len); // More shift at edges
      
      vec3 col;
      col.r = getEclipse(p - vec2(aberrationAmt, 0.0)).r;
      col.g = getEclipse(p).g; // Green is anchor
      col.b = getEclipse(p + vec2(aberrationAmt, 0.0)).b;
      
      // 4. Color Grading / Post-Process
      
      // Dark energy boost: Darken the center slightly to make the ring pop
      col *= smoothstep(0.1, 0.5, len); 

      // Hover Energy Injection
      // Shift towards a hot turquoise/violet palette from the original orange
      vec3 baseParams = vec3(1.0, 0.8, 0.5); // Warm
      vec3 hoverParams = vec3(0.6, 0.8, 1.5); // Cool/Electric
      
      vec3 tint = mix(baseParams, hoverParams, u_hover);
      col *= tint;
      
      // Final brightness boost on hover
      col *= (1.0 + 0.5 * u_hover);

      gl_FragColor = vec4(col, 1.0);
    }
  `

  return (
    <mesh 
      ref={meshRef} 
      scale={[2, 2, 1]}
      onPointerOver={() => (hoverValue.current = 1)}
      onPointerOut={() => (hoverValue.current = 0)}
    >
      <planeGeometry args={[1.5, 1.5]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}
