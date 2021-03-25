export default `
const float Sq3 = sqrt(3.0) / 2.0;
const mat2 D = mat2(Sq3 * 2.0, Sq3, 0.0, -1.5);

uniform vec2 resolution;
uniform vec3 pos;

attribute vec4 a_position;
attribute vec2 a_texcoord;
attribute vec2 a_ab;

varying vec2 v_texCoord;
varying vec2 v_ab;

void main() {
  gl_Position = vec4((a_position.xy - pos.xy * D) * vec2(2.0, 2.0 * resolution.x / resolution.y) * pos.z, a_position.zw);
  v_texCoord = a_texcoord;
  v_ab = a_ab;
}
`;
