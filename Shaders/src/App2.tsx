import { Canvas } from "@react-three/fiber"
import Showcase1 from "./Showcase/Showcase1"

const App2 = () => {
    return (
        <div style={{ width: '100%', height: '100vh' }}> {/* Responsive container */}
            <Canvas
                style={{ width: '100%', height: '100%' }} // Fills the parent
                dpr={[1, 2]} // Handles high-DPI screens
                camera={{ position: [0, 1.5, 7], fov: 50 }}
            >
                <color attach="background" args={['#fd8b8b']} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <Showcase1 />
            </Canvas>
        </div>
    )
}

export default App2