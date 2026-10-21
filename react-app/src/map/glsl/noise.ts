/**
 * A tiny GLSL noise toolkit, shared by the water and grass shaders.
 * Paste `NOISE_GLSL` into a shader's header to get:
 *
 *   wHash(p)      a random number 0..1 for each grid point
 *   vnoise(p)     "value noise": random values on a grid, smoothly blended in between
 *   noiseGrad(p)  the slope of vnoise — used to tilt surface normals for fine texture
 *   fbm2(p)       three layers of vnoise at different scales, for natural-looking variation
 *
 * No textures needed: everything is computed from the position.
 */
export const NOISE_GLSL = /* glsl */ `
float wHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wHash(i), wHash(i + vec2(1.0, 0.0)), u.x),
             mix(wHash(i + vec2(0.0, 1.0)), wHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 noiseGrad(vec2 p) {
  float e = 0.12;
  return vec2(vnoise(p + vec2(e, 0.0)) - vnoise(p - vec2(e, 0.0)),
              vnoise(p + vec2(0.0, e)) - vnoise(p - vec2(0.0, e))) / (2.0 * e);
}
float fbm2(vec2 p) {
  return 0.5 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 7.1) + 0.2 * vnoise(p * 4.1 + 3.7);
}
`
