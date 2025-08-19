export const skyVert = String.raw`varying vec3 vPos;
void main(){
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

export const skyFrag = String.raw`uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float timeOfDay;
varying vec3 vPos;
void main(){
  float t = smoothstep(-0.2,0.8, vPos.y);
  vec3 c = mix(bottomColor, topColor, t);
  c = mix(c, vec3(0.02,0.02,0.06), smoothstep(0.65,1.0,timeOfDay));
  gl_FragColor = vec4(pow(c, vec3(1.0/2.2)),1.0);
}`;
