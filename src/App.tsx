import React from 'react';
import SceneView from './three/SceneView';

export default function App() {
  return (
    <div className="canvas-wrap">
      <div className="overlay">
        <div><strong>Three.js GLSL Environment</strong></div>
        <div className="hint">W/S/A/D or Touch to move • Click glowing cube to toggle waves</div>
        <div id="fps"></div>
      </div>
      <SceneView />
    </div>
  );
}
