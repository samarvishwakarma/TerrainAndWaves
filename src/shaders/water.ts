export const waterVert = /* glsl */ String.raw`
  // waterVert.glsl
  uniform float uTime;
  uniform float uWaveAmp;

  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vWaveHeight;

  // Simple 2D noise function (value noise approximation)
  float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
      vec3 newPos = position;

      // Multiple moving sine-based waves
      float wave1 = sin(position.x * 0.15 + uTime * 0.6);
      float wave2 = cos(position.z * 0.18 + uTime * 0.45);
      float wave3 = sin((position.x + position.z) * 0.07 + uTime * 0.3);

      // Add animated procedural noise for variation
      float noiseWave = noise((position.xz * 0.2) + vec2(uTime * 0.05, uTime * 0.07)) * 2.0 - 1.0;

      // Blend waves and noise
      float wave = (wave1 + wave2 + wave3) * 0.4 + noiseWave * 0.6;

      // Apply displacement
      newPos.y += wave * uWaveAmp;

      // Pass wave height for shading in fragment
      vWaveHeight = wave;

      // Recompute normals in view space for lighting
      vNormal = normalize(normalMatrix * normal);
      vPos = (modelMatrix * vec4(newPos, 1.0)).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }

`;

export const waterFrag = /* glsl */ String.raw`
  uniform float uTime;
  uniform float uTimeOfDay; // optional day-night tint

  varying vec3 vNormal;
  varying vec3 vPos;

  void main() {
      // Normalized normal for fake shading
      vec3 n = normalize(vNormal);

      // Base color mix (deep vs shallow water)
      vec3 deepBlue = vec3(0.1, 0.25, 0.5);
      vec3 shallowBlue = vec3(0.0, 0.5, 0.7);

      float depthFactor = clamp((vPos.y + 5.0) / 10.0, 0.0, 1.0);
      vec3 waterColor = mix(deepBlue, shallowBlue, depthFactor);

      // Add a bit of "shimmer" using normals
      float fresnel = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
      waterColor += fresnel * 0.2;

      // Optional time-of-day tint
      waterColor = mix(waterColor, vec3(0.05, 0.05, 0.1), uTimeOfDay);

      gl_FragColor = vec4(waterColor, 1.0);
  }
`;
