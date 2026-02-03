import { Canvas } from '@react-three/fiber'
import { SphereShade } from './Shader1/SphereShade'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {Sphere2Shader} from './Shader1/Sphere2Shader'
import { SphereShade2 } from './Shader1/SphereShade2'
import { BufferShaders14 } from './Shader1/BufferShaders14'
import { StrangeAttractor } from './Shader1/StrangeAttractor'
import { BufferShader1 } from './Shader1/BufferShader1'
import { ParticleBuffer } from './Shader1/ParticleBuffer'
import { ParticleBuffer2 } from './Shader1/ParticleBuffer2'
import { ParticleBuffer3 } from './Shader1/ParticleBuffer3'

const App = () => {
  return (
    <div style={{ width: '100%', height: '100vh' }}> {/* Responsive container */}
      <Canvas
        style={{ width: '100%', height: '100%' }} // Fills the parent
        dpr={[1, 2]} // Handles high-DPI screens
        camera={{ position: [0, 0, 5], fov: 50 }} 
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        {/* <SphereShade2 /> */}
        {/* <BufferShaders14 /> */}
        {/* <StrangeAttractor /> */}
        {/* <BufferShader1 /> */}
        {/* <ParticleBuffer /> */}
        {/* <ParticleBuffer2 /> */}
        <ParticleBuffer3 />
        <OrbitControls /> 
      </Canvas>
    </div>
  )
}

export default App