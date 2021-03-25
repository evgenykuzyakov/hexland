export default `

const float Sq3 = sqrt(3.0) / 2.0;
const mat2 D = mat2(Sq3 * 2.0, Sq3, 0.0, -1.5);

attribute vec4 position;
uniform vec2 resolution;
uniform vec2 pos;
uniform float zoom;
uniform vec2 offset;

void main() {
  vec2 c = (pos - offset) * D;
  gl_Position = vec4((position.xy + c) * vec2(2.0, 2.0 * resolution.x / resolution.y) * zoom - vec2(1.0, -1.0), position.zw);
}
`;
