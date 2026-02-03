import { Canvas } from "@react-three/fiber"
// import Showcase2 from "./Showcase/Showcase2"
import Showcase3 from "./Showcase/Showcase3"

const App3 = () => {
    return (
        <div style={{ width: '100%', height: '100vh' }}> {/* Responsive container */}
            <Canvas
                // gl={{ localClippingEnabled: true }}
                style={{ width: '100%', height: '100%' }} // Fills the parent
                dpr={[1, 2]} // Handles high-DPI screens
                camera={{ position: [0, 0, 6], fov: 60 }}
            >
                <color attach="background" args={['#fd8b8b']} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                {/* <Showcase2 /> */}
                <Showcase3 />
            </Canvas>
        </div>
    )
}

export default App3