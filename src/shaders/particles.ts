export const particlesVert = String.raw`attribute float aSpeed;
uniform float uTime;
void main(){
  vec3 p = position;
  float t = mod(uTime * aSpeed + position.y*0.01, 200.0);
  p.y = position.y - t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
  gl_PointSize = 1.8;
}`;

export const particlesFrag = String.raw`void main(){
  float d = length(gl_PointCoord.xy - 0.5);
  if(d>0.5) discard;
  gl_FragColor = vec4(0.8,0.9,1.0,0.9);
}`;
