import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import SimplexNoiseFast from './noise/SimplexNoiseFast';
import { skyVert, skyFrag } from '../shaders/sky';
import { terrainVert, terrainFrag } from '../shaders/terrain';
import { waterVert, waterFrag } from '../shaders/water';
import { particlesVert, particlesFrag } from '../shaders/particles';
import { OrbitControls } from "three/addons/controls/OrbitControls";

type Params = {
  terrainSize: number;
  terrainSegmentsHigh: number;
  terrainSegmentsMid: number;
  terrainSegmentsLow: number;
  waterSize: number;
  particleCount: number;
  rainHeight: number;
  dayLengthSec: number;
};

const params: Params = {
  terrainSize: 200,
  terrainSegmentsHigh: 256,
  terrainSegmentsMid: 128,
  terrainSegmentsLow: 64,
  waterSize: 10000,
  particleCount: 30000,
  rainHeight: 250,
  dayLengthSec: 120,
};

export default function SceneView() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const { clientWidth, clientHeight } = containerRef.current;
    renderer.setSize(clientWidth, clientHeight);
    renderer.colorSpace = THREE.sRGBEncoding;
    containerRef.current.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, clientWidth / clientHeight, 0.1, 2000);
    camera.position.set(0, 40, 80);
    let target = new THREE.Vector3();
    let move = { forward: 0, right: 0 };
    const keys = { w: 87, s: 83, a: 65, d: 68 };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.keyCode === keys.w) move.forward = 1;
      if (e.keyCode === keys.s) move.forward = -1;
      if (e.keyCode === keys.a) move.right = -1;
      if (e.keyCode === keys.d) move.right = 1;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.keyCode === keys.w || e.keyCode === keys.s) move.forward = 0;
      if (e.keyCode === keys.a || e.keyCode === keys.d) move.right = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Pointer controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;       
    controls.dampingFactor = 0.05;       
    controls.enablePan = false;          
    controls.minDistance = 5;            
    controls.maxDistance = 500;          
    controls.maxPolarAngle = Math.PI/2; 
    
    let isPointerDown = false, lastX = 0, lastY = 0;
    let yaw = 0, pitch = 0;

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Lights
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.castShadow = true;
    scene.add(sun);
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambient);

    // Sky
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x88bbee) },
        bottomColor: { value: new THREE.Color(0xd9ecff) },
        timeOfDay: { value: 0 }
      },
      vertexShader: skyVert,
      fragmentShader: skyFrag
    });
    const skyGeo = new THREE.SphereGeometry(1000, 32, 15);
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // Height map for collisions
    const noise = new SimplexNoiseFast();
    const heightMapResolution = 512;
    const heightMap = new Float32Array(heightMapResolution * heightMapResolution);
    const buildHeightMap = () => {
      const size = params.terrainSize;
      const half = size / 2;
      const res = heightMapResolution;
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const x = (i / res) * size - half;
          const z = (j / res) * size - half;
          let h = 0;
          h += 12.0 * noise.noise(x*0.003, 0.0, z*0.003);
          h += 4.0  * noise.noise(x*0.02,  0.0, z*0.02);
          h += 1.0  * noise.noise(x*0.08,  0.0, z*0.08);
          heightMap[j * res + i] = h;
        }
      }
    };
    buildHeightMap();
    const sampleHeightAt = (x: number, z: number) => {
      const size = params.terrainSize;
      const half = size / 2;
      const res = heightMapResolution;
      const u = ((x + half) / size);
      const v = ((z + half) / size);
      if (u < 0 || u > 1 || v < 0 || v > 1) return -1000;
      const ix = Math.floor(u * (res - 1));
      const iz = Math.floor(v * (res - 1));
      return heightMap[iz * res + ix];
    };

    // Terrain creator
    const createTerrainMesh = (size: number, segments: number, heightScale: number) => {
      const geo = new THREE.PlaneGeometry(size, size, segments, segments);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1.0 },
          uHeight: { value: heightScale },
          uTimeOfDay: { value: 0 }
        },
        vertexShader: terrainVert,
        fragmentShader: terrainFrag,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.renderOrder = 2
      return mesh;
    };

    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    const high = createTerrainMesh(params.terrainSize*0.5, 160, 12.0);
    high.position.set(0,0,0);
    terrainGroup.add(high);
    const mid = createTerrainMesh(params.terrainSize, 120, 8.0);
    mid.position.set(0,0,0);
    terrainGroup.add(mid);
    const low = createTerrainMesh(params.terrainSize*2, 80, 4.0);
    low.position.set(0,0,0);
    terrainGroup.add(low);

    // Interactive cube
    const cubeGeo = new THREE.BoxGeometry(6,6,6);
    const cubeMat = new THREE.MeshStandardMaterial({ color:0xffaa33, emissive:0x552200, metalness:0.1, roughness:0.6 });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(20,8,-10);
    cube.castShadow = true;
    scene.add(cube);
    let cubeActive = false;

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObject(cube);
      if (hits.length > 0) {
        cubeActive = !cubeActive;
        (cube.material as THREE.MeshStandardMaterial).emissive.setHex(cubeActive?0xff6600:0x552200);
        waterUniforms.uWaveAmp.value = cubeActive ? 5 : 2.5;
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    // Water + reflection
    const renderTarget = new THREE.WebGLRenderTarget(1024, 1024, { format: THREE.RGBAFormat, colorSpace: THREE.sRGBEncoding });
    const mirrorCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const waterUniforms: Record<string, THREE.IUniform> = {
      uTime: { value: 0 },
      uReflection: { value: renderTarget.texture },
      uWaveAmp: { value: 1.0 },
      uTimeOfDay: { value: 0 },
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      side: THREE.DoubleSide
    });
    const waterGeo = new THREE.PlaneGeometry(params.waterSize, params.waterSize, 500, 500);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -5.0;
    scene.add(water);

    // Particles (rain)
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particleCount * 3);
    const speeds = new Float32Array(params.particleCount);
    for (let i = 0; i < params.particleCount; i++) {
      const x = 10 * (Math.random() - 0.5) * params.terrainSize;
      const z = 10 * (Math.random() - 0.5) * params.terrainSize;
      const y = Math.random() * params.rainHeight + 10;
      positions[i*3+0] = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;
      speeds[i] = 2.0 + Math.random() * 10.0;
    }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    const particleMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uViewPos: { value: camera.position } },
      vertexShader: particlesVert,
      fragmentShader: particlesFrag,
      transparent: true,
      depthWrite: false
    });
    const particleMesh = new THREE.Points(particleGeometry, particleMat);
    scene.add(particleMesh);

    // Splashes (kept minimal, CPU-side)
    const splashes: Array<{x:number, y:number, z:number, t:number}> = [];
    const spawnSplash = (x:number, z:number, y:number) => { splashes.push({ x, z, y, t: 0 }); };

    // FPS
    const fpsEl = document.getElementById('fps');
    let frameCount = 0, lastFpsTime = performance.now();

    // Animation loop
    let startTime = performance.now();
    let rafId = 0;

    scene.children.forEach((element: any) => {
      element.castShadows = true;
      element.receiveShadow = true;
    })

    const animate = () => {
      const now = performance.now();
      const elapsed = (now - startTime) * 0.001;
      const dayT = (elapsed / params.dayLengthSec) % 1.0;

      // uniforms
      (high.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      (mid.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      (low.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      (high.material as THREE.ShaderMaterial).uniforms.uTimeOfDay.value = dayT;
      (mid.material as THREE.ShaderMaterial).uniforms.uTimeOfDay.value = dayT;
      (low.material as THREE.ShaderMaterial).uniforms.uTimeOfDay.value = dayT;
      waterUniforms.uTime.value = elapsed *5;
      waterUniforms.uTimeOfDay.value = dayT;
      (skyMat.uniforms.timeOfDay as THREE.IUniform).value = dayT;

      // sun & ambient
      const sunAngle = dayT * Math.PI * 2.0;
      const sunDir = new THREE.Vector3(Math.cos(sunAngle), Math.sin(sunAngle), 0.2).normalize();
      sun.position.copy(sunDir.clone().multiplyScalar(100));
      sun.intensity = Math.max(0.1, sunDir.y);
      ambient.intensity = 0.1 + 0.5 * Math.max(0.0, sunDir.y);

      // camera movement
      const forwardSpeed = 0.5;
      const dx = move.right * forwardSpeed;
      const dz = move.forward * forwardSpeed;
      const dir = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
      camera.position.addScaledVector(dir, dz);
      camera.position.addScaledVector(right, dx);
      target.copy(camera.position).add(new THREE.Vector3(Math.sin(yaw), Math.tan(pitch), Math.cos(yaw)).multiplyScalar(10));
      camera.lookAt(target);

      // reflection render
      mirrorCamera.position.copy(camera.position);
      mirrorCamera.position.y = -camera.position.y + water.position.y * 2.0;
      mirrorCamera.up.set(0, -1, 0);
      mirrorCamera.quaternion.copy(camera.quaternion);
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, mirrorCamera);
      renderer.setRenderTarget(null);

      // particles update
      const posAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const speedArr = (particleGeometry.getAttribute('aSpeed') as THREE.BufferAttribute).array as Float32Array;
      for (let i = 0; i < params.particleCount; i++) {
        const idx = i * 3;
        let x = posArr[idx + 0];
        let y = posArr[idx + 1];
        let z = posArr[idx + 2];
        y -= speedArr[i] * 0.2;
        const terrainH = sampleHeightAt(x, z);
        if (y <= terrainH + 0.5) {
          y = Math.random() * params.rainHeight + 10;
          spawnSplash(x, z, terrainH);
        }
        if (y <= water.position.y + 0.5) {
          y = Math.random() * params.rainHeight + 10;
          spawnSplash(x, z, water.position.y);
        }
        posArr[idx + 1] = y;
      }
      posAttr.needsUpdate = true;

      // simple splashes lifetime
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.t += 0.02;
        if (s.t > 1.0) splashes.splice(i, 1);
      }

      // FPS
      frameCount++;
      if (now - lastFpsTime > 1000) {
        if (fpsEl) fpsEl.textContent = `FPS: ${frameCount}`;
        frameCount = 0; lastFpsTime = now;
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();
    camera.lookAt(0,0,0);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="canvas-wrap" />;
}
