import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Environment } from '@react-three/drei';
import type { Mesh } from 'three';

const AnimatedSphere = () => {
  const sphereRef = useRef<Mesh>(null!);

  useFrame(({ clock }) => {
    // Subtle floating movement
    sphereRef.current.position.y = Math.sin(clock.getElapsedTime() / 2) * 0.1;
    // Slow rotation
    sphereRef.current.rotation.y = clock.getElapsedTime() * 0.2;
  });

  return (
    <Sphere args={[1, 64, 64]} scale={2.5} ref={sphereRef}>
      <MeshDistortMaterial
        color="#3b82f6" // A nice tech blue
        attach="material"
        distort={0.5} // How much it wobbles
        speed={1.5} // How fast it wobbles
        roughness={0.1}
        metalness={0.9} // Gives it a shiny, reflective quality
        wireframe={true} // The "engineering blueprint" look
      />
    </Sphere>
  );
};

const ThreeScene = () => {
  return (
    <div className="h-[500px] w-full cursor-grab active:cursor-grabbing">
      <Canvas camera={{ position: [0, 0, 6] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        {/* Environment adds subtle realistic reflections */}
        <Environment preset="city" />
        <AnimatedSphere />
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  );
};

export default ThreeScene;
