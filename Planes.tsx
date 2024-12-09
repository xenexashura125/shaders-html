function Planes({ color, ...props } : CircleProps) { 
    const planeRef = useRef<any>(null); 
    const clock = useRef(new THREE.Clock())
    useFrame((state, delta) => { 
        const time = clock.current.getDelta();// get the elapsed time 
        // if (planeRef.current.material.uniforms.u_time.value >= 2.5) { 
        //     planeRef.current.material.uniforms.u_time.value = planeRef.current.material.uniforms.u_time.value;
        // } 
        // else { 
        // } 
        planeRef.current.material.uniforms.u_time.value += time / 4; 
        planeRef.current.material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight); 
    }); 
    useEffect(() => { 
        function onMouseMove(event:MouseEvent) { 
            const { clientX, clientY } = event; 
            const x = (clientX / window.innerWidth) * 2 - 1; 
            const y = -(clientY / window.innerHeight) * 2 + 1; 
            planeRef.current.material.uniforms.u_mouse.value.set(x, y); 
        } 
        window.addEventListener("mousemove", onMouseMove); 
        return () => window.removeEventListener("mousemove", onMouseMove); 
    }, []); 

    const texture = useTexture("./img/us.jpg"); 
    return ( 
        <> 
            <mesh ref={planeRef} {...props}> 
            <planeGeometry args={[1.4,1.2]}/> 
            <shaderMaterial 
                toneMapped={false}
                vertexColors={false}
                transparent={true} // Enable transparency
                depthWrite={false} // Disable depth write to avoid z-fighting artifacts
                uniforms={{ 
                    u_tex0: { value: texture }, 
                    u_time: { value: 1.0 }, 
                    u_resolution: { value: new THREE.Vector2() }, 
                    u_mouse: { value: new THREE.Vector2() }, }
                } 
                vertexShader={`
                    varying vec2 vUv; 
                    void main() { 
                        vUv = uv; 
                        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); 
                    } 
                    `
                } 
                fragmentShader={` 
                    uniform sampler2D u_tex0; 
                    uniform float u_time; 
                    uniform vec2 u_resolution; 
                    varying vec2 vUv; 
                    #define PI 3.14159265358979323846 
                    float pixelPattern(float x, float frequency, float speed, float time) { 
                        return sin((x * frequency - time * speed) * 2.0 * PI); 
                    } 
                    void main() { 
                        vec2 st = vUv;
                
                        vec4 img = texture2D(u_tex0, st);
                        float gapSizeY = 0.7;
                        float gapSizeX = 0.0;
                        int numBoxes = 10;
                        float boxSizeY = 1.0 / float(numBoxes);
                        float boxSizeX = 1.0 / float(numBoxes);
                        vec4 color = vec4(1.0, 1.0, 1.0, 1.0);
                        bool isInsideBox = false;
                
                        for (int i = 0; i < numBoxes; ++i) {
                            float columnDelay = 0.1;
                            float maxColumn = float(numBoxes) - 1.0;
                            float timeBasedOffset = u_time - (maxColumn - float(i)) * columnDelay;
                
                            float scaleX = boxSizeX * (clamp(smoothstep(0.0, 1.0, (timeBasedOffset)), 0.0, 1.0));

                            float scaleY = boxSizeY * (clamp(smoothstep(0.0, 1.0, timeBasedOffset), 0.0, 1.0));
                                            
                            for (int j = 0; j < numBoxes; ++j) {
                                float x = gapSizeX * float(i+1) + boxSizeX * float(i);
                
                                float gapSizeYAnim = gapSizeY * (1.0 - clamp(smoothstep(0.0, 1.0, timeBasedOffset), 0.0, 1.0));
                                float y = gapSizeYAnim * float(j+1) + scaleY * float(j);
                
                
                                if (st.x > x && st.x < x + scaleX && st.y > y && st.y < y + scaleY) {
                                    color = img * vec4(0.7, 0.7, 0.7, 1.0); // Box color from the texture
                                    isInsideBox = true;
                                }
                            }
                        }
                
                        if (!isInsideBox) {
                            color.a = 0.0; // Make the background transparent
                        }
                        
                        gl_FragColor = color; 
                    } 
                `}            
            /> 
            </mesh> 
        </> 
    ); 
} 