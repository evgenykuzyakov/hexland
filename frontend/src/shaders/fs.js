export default `
precision highp float;

const float Sq3 = sqrt(3.0) / 2.0;
const mat2 D = mat2(Sq3 * 2.0, Sq3, 0.0, -1.5);

uniform vec3 color;
uniform sampler2D u_diffuse;
uniform vec2 texSize;

varying vec2 v_texCoord;
varying vec2 v_ab;

float d(vec2 p) {
  vec2 dx = (p - v_ab) * D;
  return dot(dx, dx);
}

vec3 mind(vec3 a, vec2 b)
{
  float db = d(b); 
  return mix(vec3(b, db), a, step(a.z, db));
}

void main() {
  vec2 fab = floor(v_ab);
  vec3 best = vec3(fab, d(fab));
  best = mind(best, fab + vec2(1.0, 0.0));
  best = mind(best, fab + vec2(0.0, 1.0));
  best = mind(best, fab + vec2(1.0, 1.0));
  
  vec4 diffuseColor = texture2D(u_diffuse, best.xy / texSize);
  if (diffuseColor.w < 1.0) {
    discard;
  }
  gl_FragColor = diffuseColor;
}
`;
