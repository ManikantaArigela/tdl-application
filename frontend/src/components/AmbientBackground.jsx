import React from 'react';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';

export default function AmbientBackground() {
  const reduceMotion = useReducedMotion();
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (reduceMotion) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    } catch {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.z = 3;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const isSmall = window.innerWidth < 768;
    const particleCount = isSmall ? 120 : 260;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 12;
      positions[i + 1] = (Math.random() - 0.5) * 12;
      positions[i + 2] = (Math.random() - 0.5) * 12;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.035,
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.34,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const nebulaGeometry = new THREE.SphereGeometry(1.4, 24, 24);
    const nebulaMaterial = new THREE.MeshBasicMaterial({
      color: 0x5b21e8,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
    });
    const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
    nebula.position.set(2.2, -2, -1.5);
    scene.add(nebula);

    const clock = new THREE.Clock();
    let frameId = 0;
    let running = true;

    const render = () => {
      if (!running) return;
      frameId = requestAnimationFrame(render);
      const elapsed = clock.getElapsedTime();
      particles.rotation.x = elapsed * 0.04;
      particles.rotation.y = elapsed * 0.025;
      nebula.rotation.y = elapsed * 0.04;
      nebulaMaterial.opacity = 0.04 + Math.sin(elapsed * 0.4) * 0.015;
      renderer.render(scene, camera);
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frameId);
      } else if (!running) {
        running = true;
        clock.getDelta();
        render();
      }
    };

    render();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.dispose();
      material.dispose();
      nebulaGeometry.dispose();
      nebulaMaterial.dispose();
      renderer.dispose();
    };
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(55% 45% at 12% 0%, rgb(var(--accent) / 0.09), transparent 70%), radial-gradient(45% 40% at 88% 8%, rgb(var(--pink) / 0.08), transparent 72%)',
        }}
      />
      {!reduceMotion && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full opacity-60"
          style={{ display: 'block' }}
        />
      )}
    </div>
  );
}
