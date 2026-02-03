import { OrbitControls, shaderMaterial } from '@react-three/drei';
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Updated GlassMaterial remains unchanged
const vertexShader = `
    attribute vec3 color;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec2 vUv;
    uniform float uSize;
    uniform float uScale;

    void main() {
        vUv = uv;
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = uSize;
        gl_PointSize *= (uScale / -mvPosition.z);
    }
`;

const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFresnelBias;
    uniform float uFresnelScale;
    uniform float uFresnelPower;
    uniform vec2 uResolution;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vColor;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        float NdotV = max(0.0, dot(viewDir, normal));
        float fresnel = uFresnelBias + uFresnelScale * pow(1.0 - NdotV, uFresnelPower);
        fresnel = clamp(fresnel * sin(uTime * fresnel * 0.5), 0.0, 1.0);

        float basePixelScale = 5.0;
        float pixelScale = basePixelScale * (uResolution.x / 1920.0);
        float moveSpeed = 0.5;
        vec2 gridUv = vUv * pixelScale + vec2(uTime * moveSpeed, uTime * moveSpeed * 0.5);
        vec2 gridPos = fract(gridUv);
        float gapThreshold = 0.05;
        float gridMask = smoothstep(gapThreshold, gapThreshold + 0.01, gridPos.x) * smoothstep(gapThreshold, gapThreshold + 0.01, gridPos.y);
        
        fresnel *= gridMask;

        vec3 rim = vec3(1.0) * pow(1.0 - NdotV, uFresnelPower + 2.0) * 0.5;
        rim *= gridMask;

        gl_FragColor = vec4(vColor + rim, fresnel);
    }
`;

const GlassMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color(0.1, 0.2, 0.3),
    uFresnelBias: 0.0,
    uFresnelScale: 0.0,
    uFresnelPower: 0.0,
    uResolution: new THREE.Vector2(),
    uSize: 0.025,
    uScale: 0,
  },
  vertexShader,
  fragmentShader
);

extend({ GlassMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    glassMaterial: any;
  }
}

// Updated SphereShade2 with new buffer logic
export const SphereShade2 = () => {
  const groupRef = useRef<THREE.Group>(null!);
  const cloudMaterialRef = useRef<any>(null!);
  const starMaterialRef = useRef<any>(null!);
  const cloudGeometryRef = useRef<THREE.BufferGeometry>(null!);
  const starGeometryRef = useRef<THREE.BufferGeometry>(null!);
  const { size } = useThree();
  const particleCount = 100000;
  const starCount = 5000;
  const gapFactor = 0.0;
  const spacingMultiplier = 2;

  const { cloudPositions, cloudNormals, cloudUvs, cloudColorsArray, finalCloudCount, starPositions, starNormals, starUvs, starColorsArray, finalStarCount, yMin, yRange } = useMemo(() => {
    const resol = Math.max(2, Math.round(Math.cbrt(particleCount)));
    const spacing = (2 / resol) * spacingMultiplier;

    const cloudPosArr: number[] = [];
    const cloudColArr: number[] = [];

    const starPosArr: number[] = [];
    const starColArr: number[] = [];

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
          cloudPosArr.push(fx, fy, fz);

          // Adjusted colors for more Milky Way-like appearance (blues, purples, whites)
          const t = (Math.sin(radius * 5) + 1) / 2; // Use sinusoidal variation based on radius for banding
          let r = 0.4 + 0.3 * t + (Math.random() - 0.5) * 0.1;
          let g = 0.5 + 0.2 * (1 - t) + (Math.random() - 0.5) * 0.1;
          let b = 0.7 + 0.3 * (0.5 + 0.5 * (1 - t)) + (Math.random() - 0.5) * 0.1;

          // Clamp colors to 0-1
          r = Math.max(0, Math.min(1, r));
          g = Math.max(0, Math.min(1, g));
          b = Math.max(0, Math.min(1, b));

          cloudColArr.push(r, g, b);
        }
      }
    }

    const actualCloudCount = cloudPosArr.length / 3;

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

    // Convert to Float32Arrays
    const cloudPositionsArray = new Float32Array(cloudPosArr);
    const cloudColorsArray = new Float32Array(cloudColArr);
    const starPositionsArray = new Float32Array(starPosArr);
    const starColorsArray = new Float32Array(starColArr);

    // Compute normals and UVs for cloud
    const cloudNormals = new Float32Array(actualCloudCount * 3);
    const cloudUvs = new Float32Array(actualCloudCount * 2);
    let cloudMinY = Infinity;
    let cloudMaxY = -Infinity;

    for (let i = 0; i < actualCloudCount; i++) {
      const px = cloudPositionsArray[i * 3 + 0];
      const py = cloudPositionsArray[i * 3 + 1];
      const pz = cloudPositionsArray[i * 3 + 2];
      const len = Math.sqrt(px * px + py * py + pz * pz);
      cloudNormals[i * 3 + 0] = len > 0 ? px / len : 0;
      cloudNormals[i * 3 + 1] = len > 0 ? py / len : 0;
      cloudNormals[i * 3 + 2] = len > 0 ? pz / len : 1;

      if (py < cloudMinY) cloudMinY = py;
      if (py > cloudMaxY) cloudMaxY = py;
    }

    const cloudYRange = cloudMaxY - cloudMinY || 1;

    for (let i = 0; i < actualCloudCount; i++) {
      const px = cloudPositionsArray[i * 3 + 0];
      const py = cloudPositionsArray[i * 3 + 1];
      const pz = cloudPositionsArray[i * 3 + 2];
      const angle = Math.atan2(pz, px);
      cloudUvs[i * 2 + 0] = (angle + Math.PI) / (2 * Math.PI);
      cloudUvs[i * 2 + 1] = (py - cloudMinY) / cloudYRange;
    }

    // Compute normals and UVs for stars
    const starNormals = new Float32Array(actualStarCount * 3);
    const starUvs = new Float32Array(actualStarCount * 2);
    let starMinY = Infinity;
    let starMaxY = -Infinity;

    for (let i = 0; i < actualStarCount; i++) {
      const px = starPositionsArray[i * 3 + 0];
      const py = starPositionsArray[i * 3 + 1];
      const pz = starPositionsArray[i * 3 + 2];
      const len = Math.sqrt(px * px + py * py + pz * pz);
      starNormals[i * 3 + 0] = len > 0 ? px / len : 0;
      starNormals[i * 3 + 1] = len > 0 ? py / len : 0;
      starNormals[i * 3 + 2] = len > 0 ? pz / len : 1;

      if (py < starMinY) starMinY = py;
      if (py > starMaxY) starMaxY = py;
    }

    const starYRange = starMaxY - starMinY || 1;

    for (let i = 0; i < actualStarCount; i++) {
      const px = starPositionsArray[i * 3 + 0];
      const py = starPositionsArray[i * 3 + 1];
      const pz = starPositionsArray[i * 3 + 2];
      const angle = Math.atan2(pz, px);
      starUvs[i * 2 + 0] = (angle + Math.PI) / (2 * Math.PI);
      starUvs[i * 2 + 1] = (py - starMinY) / starYRange;
    }

    // Overall yMin and yRange for color animation (combine both)
    const overallMinY = Math.min(cloudMinY, starMinY);
    const overallMaxY = Math.max(cloudMaxY, starMaxY);
    const overallYRange = overallMaxY - overallMinY || 1;

    return {
      cloudPositions: cloudPositionsArray,
      cloudNormals,
      cloudUvs,
      cloudColorsArray,
      finalCloudCount: actualCloudCount,
      starPositions: starPositionsArray,
      starNormals,
      starUvs,
      starColorsArray,
      finalStarCount: actualStarCount,
      yMin: overallMinY,
      yRange: overallYRange,
    };
  }, [gapFactor, spacingMultiplier]);

  const cloudColorsRef = useRef(cloudColorsArray);
  const starColorsRef = useRef(starColorsArray);

  useFrame(({ clock }) => {
    // Update cloud colors
    const cloudCol = cloudColorsRef.current;
    const offset = (clock.getElapsedTime() * 0.2) % 1;
    for (let i = 0; i < finalCloudCount; i++) {
      const baseT = (cloudPositions[i * 3 + 1] - yMin) / yRange;
      const t = (baseT + offset) % 1;
      const h = 220 / 360 + t * (60 / 360 - 220 / 360);
      const l = 0.15 + t * (0.50 - 0.15);
      const c = new THREE.Color().setHSL(h, 1, l);
      cloudCol[i * 3 + 0] = c.r;
      cloudCol[i * 3 + 1] = c.g;
      cloudCol[i * 3 + 2] = c.b;
    }
    if (cloudGeometryRef.current?.attributes?.color) {
      cloudGeometryRef.current.attributes.color.array = cloudCol;
      cloudGeometryRef.current.attributes.color.needsUpdate = true;
    }

    // Update star colors (using same logic)
    const starCol = starColorsRef.current;
    for (let i = 0; i < finalStarCount; i++) {
      const baseT = (starPositions[i * 3 + 1] - yMin) / yRange;
      const t = (baseT + offset) % 1;
      const h = 220 / 360 + t * (60 / 360 - 220 / 360);
      const l = 0.15 + t * (0.50 - 0.15);
      const c = new THREE.Color().setHSL(h, 1, l);
      starCol[i * 3 + 0] = c.r;
      starCol[i * 3 + 1] = c.g;
      starCol[i * 3 + 2] = c.b;
    }
    if (starGeometryRef.current?.attributes?.color) {
      starGeometryRef.current.attributes.color.array = starCol;
      starGeometryRef.current.attributes.color.needsUpdate = true;
    }

    const d = clock.getDelta();
    if (groupRef.current) {
      groupRef.current.rotation.y += d * 0.2;
      groupRef.current.rotation.z += d * 0.05;
    }
    if (cloudMaterialRef.current) {
      cloudMaterialRef.current.uTime = clock.getElapsedTime();
      cloudMaterialRef.current.uResolution.set(size.width, size.height);
      cloudMaterialRef.current.uScale = size.height / 2;
    }
    if (starMaterialRef.current) {
      starMaterialRef.current.uTime = clock.getElapsedTime();
      starMaterialRef.current.uResolution.set(size.width, size.height);
      starMaterialRef.current.uScale = size.height / 2;
    }
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry ref={cloudGeometryRef}>
          <bufferAttribute attach="attributes-position" count={finalCloudCount} array={cloudPositions} itemSize={3} />
          <bufferAttribute attach="attributes-normal" count={finalCloudCount} array={cloudNormals} itemSize={3} />
          <bufferAttribute attach="attributes-uv" count={finalCloudCount} array={cloudUvs} itemSize={2} />
          <bufferAttribute attach="attributes-color" count={finalCloudCount} array={cloudColorsRef.current} itemSize={3} />
        </bufferGeometry>
        <glassMaterial
          ref={cloudMaterialRef}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uFresnelBias={0.1}
          uFresnelScale={0.9}
          uFresnelPower={2.5}
          uColor={new THREE.Color(0.1, 0.2, 0.3)}
          uSize={0.015}
        />
      </points>
      <points>
        <bufferGeometry ref={starGeometryRef}>
          <bufferAttribute attach="attributes-position" count={finalStarCount} array={starPositions} itemSize={3} />
          <bufferAttribute attach="attributes-normal" count={finalStarCount} array={starNormals} itemSize={3} />
          <bufferAttribute attach="attributes-uv" count={finalStarCount} array={starUvs} itemSize={2} />
          <bufferAttribute attach="attributes-color" count={finalStarCount} array={starColorsRef.current} itemSize={3} />
        </bufferGeometry>
        <glassMaterial
          ref={starMaterialRef}
          transparent={true}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uFresnelBias={0.1}
          uFresnelScale={0.9}
          uFresnelPower={2.5}
          uColor={new THREE.Color(0.1, 0.2, 0.3)}
          uSize={0.05}
        />
      </points>
    </group>
  );
};