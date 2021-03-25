export default `
uniform vec2 resolution;

attribute vec4 a_position;
attribute vec2 a_texcoord;
attribute vec2 a_ab;

varying vec2 v_texCoord;
varying vec2 v_ab;

void main() {
  gl_Position = a_position;
  v_texCoord = a_texcoord;
  v_ab = a_ab;
}
`;
