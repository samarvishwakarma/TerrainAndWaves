# Three.js + GLSL Interactive 3D Environment (React + Vite)

This is a React + TypeScript port of your single-file Three.js demo. It keeps plain Three.js (no extra libs) and splits the code into modular components and shader files.

## Run locally

```bash
npm i
npm run dev
```

Then open the printed local address in your browser.

## Build

```bash
npm run build
npm run preview
```

## Structure
- `src/main.tsx` – React entry
- `src/App.tsx` – Overlay + SceneView
- `src/three/SceneView.tsx` – Creates the Three.js scene, controls, loop
- `src/three/noise/SimplexNoiseFast.ts` – CPU-side simplex noise for the height map
- `src/shaders/*.ts` – Shader sources (as template strings)

Controls: **W/A/S/D** to move, drag/hold to rotate. Click the glowing cube to toggle wave amplitude.
