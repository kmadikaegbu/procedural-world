import {
  Color,
  MeshStandardMaterial,
  Vector4,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { MAP_SIZE } from '../noise'
import { NOISE_GLSL } from '../glsl/noise'
import { WAVE_COUNT } from './waves'

/**
 * WATER MATERIAL — three's standard material with a few extra steps spliced
 * into its shader. We keep three's own lighting, shadows and fog, and add:
 *
 *   VERTEX (runs once per corner of the water mesh)
 *     • Gerstner waves lift and bunch the surface up (see waves.ts)
 *     • waves shrink where the water is shallow, like real waves near a beach
 *     • a matching surface normal, so the lighting follows the waves
 *
 *   FRAGMENT (runs once per pixel)
 *     • COLOUR BY DEPTH — read the depth map: shallow = pale turquoise and
 *       see-through, deep = dark blue and nearly opaque
 *     • FOAM — white bands that lap in and out where the water is shallow, and
 *       whitecaps on the tallest crests
 *     • RIPPLES — small moving bumps added to the normal, so the sun glitters
 *       and reflections shimmer; raindrops add expanding rings
 *     • FRESNEL — water looks clear when you look straight down and mirrors the
 *       sky when you look across it at a shallow angle
 *
 * "Uniforms" below are numbers the shader reads. Changing one is instant and
 * never recompiles the shader — that's how every slider stays smooth.
 */

export interface WaterUniforms {
  uTime: { value: number }
  uLevel: { value: number }
  uMapSize: { value: number }
  /** Vertical scale (1 readable, 1/15 true to scale) — see scale.ts */
  uVScale: { value: number }
  /** Fine depth map over the detail square (see depthMap.ts). */
  uDepthTex: { value: DataTexture | null }
  /** x = hMin, y = hRange */
  uDepthInfo: { value: Vector4 }
  /** Coarse depth map over the whole city. */
  uWideTex: { value: DataTexture | null }
  /** x = hMin, y = hRange, z = world x of the image's left edge, w = world z of its top edge */
  uWideInfo: { value: Vector4 }
  /** x, y = world size of the coarse image */
  uWideSize: { value: Vector4 }
  /** 1 when the mesh spans the whole city (so the coarse map is used beyond the detail square) */
  uUseWide: { value: number }
  /** per wave: x,y = direction, z = k, w = height weight */
  uWaves: { value: Vector4[] }
  /** per wave: crest speed */
  uWaveSpeed: { value: number[] }
  uWaveHeight: { value: number }
  uChop: { value: number }
  uRipple: { value: number }
  uClarity: { value: number }
  uFoam: { value: number }
  uReflect: { value: number }
  uRain: { value: number }
  uShallow: { value: Color }
  uDeep: { value: Color }
  uSky: { value: Color }
}

export function createWaterUniforms(): WaterUniforms {
  return {
    uTime: { value: 0 },
    uLevel: { value: 0 },
    uMapSize: { value: MAP_SIZE },
    uVScale: { value: 1 },
    uDepthTex: { value: null },
    uDepthInfo: { value: new Vector4(0, 1, 0, 0) },
    uWideTex: { value: null },
    uWideInfo: { value: new Vector4(0, 1, 0, 0) },
    uWideSize: { value: new Vector4(1, 1, 0, 0) },
    uUseWide: { value: 0 },
    uWaves: { value: Array.from({ length: WAVE_COUNT }, () => new Vector4()) },
    uWaveSpeed: { value: Array<number>(WAVE_COUNT).fill(0) },
    uWaveHeight: { value: 0.1 },
    uChop: { value: 0.5 },
    uRipple: { value: 0.5 },
    uClarity: { value: 2 },
    uFoam: { value: 0.6 },
    uReflect: { value: 0.5 },
    uRain: { value: 0 },
    uShallow: { value: new Color('#58b9c4') },
    uDeep: { value: new Color('#0c3556') },
    uSky: { value: new Color('#8fa3b0') },
  }
}

// --- shared by both stages: the depth lookup ----------------------------------

const SHARED = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uMapSize;
uniform float uVScale;
uniform sampler2D uDepthTex;
uniform vec4 uDepthInfo;
uniform sampler2D uWideTex;
uniform vec4 uWideInfo;
uniform vec4 uWideSize;
uniform float uUseWide;

// Depth from the fine map (detail square) and from the coarse map (whole city):
// the sea level minus the terrain height stored in the image.
float depthFine(vec2 xz) {
  vec2 uv = xz / uMapSize + 0.5;
  return uLevel - (texture2D(uDepthTex, uv).r * uDepthInfo.y + uDepthInfo.x);
}
float depthWide(vec2 xz) {
  vec2 uv = (xz - uWideInfo.zw) / uWideSize.xy;
  return uLevel - (texture2D(uWideTex, uv).r * uWideInfo.y + uWideInfo.x);
}

// How deep is the water at this spot? Negative = dry land.
// Inside the detail square the fine map is used, outside it the coarse one, with
// a soft hand-over across the square's last 10 units so there is no visible seam.
// Divided by the vertical scale, so depth is always measured in the units the
// shader's thresholds were tuned in (clarity, shore foam, wave damping): a river
// drawn at true scale (15× shallower) still looks as deep as it really is.
float waterDepth(vec2 xz) {
  float d;
  if (uUseWide > 0.5) {
    float edge = max(abs(xz.x), abs(xz.y));
    float fineW = 1.0 - smoothstep(uMapSize * 0.5 - 10.0, uMapSize * 0.5, edge);
    float a = fineW > 0.0 ? depthFine(xz) : 0.0;
    float b = fineW < 1.0 ? depthWide(xz) : 0.0;
    d = mix(b, a, fineW);
  } else {
    d = depthFine(xz);
  }
  return d / uVScale;
}
`

// --- vertex stage -------------------------------------------------------------

const VERT_HEADER = /* glsl */ `
${SHARED}
uniform vec4 uWaves[${WAVE_COUNT}];
uniform float uWaveSpeed[${WAVE_COUNT}];
uniform float uWaveHeight;
uniform float uChop;
varying vec3 vWorldPos;
varying float vCrest;

// Add up the waves at point p. Outputs how far to move the point (disp), the
// surface normal there, and how high the crest is (0..1, used for whitecaps).
void waveField(vec2 p, float atten, out vec3 disp, out vec3 nrm, out float crest) {
  disp = vec3(0.0);
  float nx = 0.0;
  float nz = 0.0;
  float ny = 0.0;
  crest = 0.0;
  for (int i = 0; i < ${WAVE_COUNT}; i++) {
    vec2 dir = uWaves[i].xy;
    float k = uWaves[i].z;
    float full = uWaves[i].w * uWaveHeight;   // this wave's height in open water
    float amp = full * atten;                 // …shrunk in the shallows
    float phase = k * (dot(dir, p) - uWaveSpeed[i] * uTime);
    float c = cos(phase);
    float s = sin(phase);
    // Q is how hard crests are pulled sideways. Chosen so that, summed over all
    // the waves, the surface never folds over itself (that would look like a glitch).
    float q = uChop / (k * max(full, 1e-4) * ${WAVE_COUNT}.0);
    disp.x += q * amp * dir.x * c;
    disp.z += q * amp * dir.y * c;
    disp.y += amp * s;
    nx -= dir.x * k * amp * c;
    nz -= dir.y * k * amp * c;
    ny -= q * k * amp * s;
    crest += amp * s;
  }
  nrm = normalize(vec3(nx, 1.0 + ny, nz));
  crest = crest / max(uWaveHeight, 1e-3);
}
`

// replaces three's "start with the mesh's own normal": we compute the wavy one instead
const VERT_NORMAL = /* glsl */ `
vec2 wp = position.xz;                    // the mesh sits at x = z = 0, so this is world x,z
float wAtten = smoothstep(0.0, 1.2, waterDepth(wp));
vec3 wDisp;
vec3 objectNormal;
float wCrest;
waveField(wp, wAtten, wDisp, objectNormal, wCrest);
vCrest = wCrest;
vWorldPos = vec3(wp.x, 0.0, wp.y);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3( tangent.xyz );
#endif
`

// --- fragment stage -----------------------------------------------------------

const FRAG_HEADER = /* glsl */ `
${SHARED}
uniform float uRipple;
uniform float uClarity;
uniform float uFoam;
uniform float uReflect;
uniform float uRain;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
varying vec3 vWorldPos;
varying float vCrest;

// How close is dry land? Look at points in a circle around here and ask the depth
// map whether any of them are land. Banks here are nearly vertical, so "how shallow
// is it" can't make a shoreline — "how near is land" can.
//   returns ~0.8 if land is right next to us, fading to 0 about 1.5 units away
float landProximity(vec2 xz) {
  float prox = 0.0;
  for (int r = 0; r < 3; r++) {
    float rad = 0.4 + float(r) * 0.55;       // rings at 0.4, 0.95 and 1.5 units
    float hit = 0.0;
    for (int a = 0; a < 8; a++) {
      float ang = float(a) * 0.7854;         // 8 directions, 45° apart
      if (waterDepth(xz + rad * vec2(cos(ang), sin(ang))) < 0.0) hit = 1.0;
    }
    prox = max(prox, hit * (1.0 - rad / 1.9));
  }
  return prox;
}

// --- noise toolkit (wHash, vnoise, noiseGrad, fbm2), shared with the grass ---
${NOISE_GLSL}
// raindrops: each grid cell, at a random moment, sends out one expanding ring
vec2 rainRipples(vec2 p, float t) {
  vec2 q = p * 3.0;
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float phase = fract(t * 0.9 + wHash(cell) * 7.0);
  vec2 centre = (vec2(wHash(cell + 3.1), wHash(cell + 8.7)) - 0.5) * 0.6;
  vec2 d = f - centre;
  float ring = phase * 0.45;                       // the ring grows as the drop ages
  float w = smoothstep(0.08, 0.0, abs(length(d) - ring)) * (1.0 - phase);
  return normalize(d + vec2(1e-4)) * w * 3.0;
}
`

// after three has set the base colour: colour the water from its depth, add foam
const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
float wDepth = waterDepth(vWorldPos.xz);
// 0 in the shallows → 1 in deep water. Light fades out exponentially with depth,
// the way it does in real water.
float wDeep = 1.0 - exp(-max(wDepth, 0.0) / max(uClarity, 0.05));
vec3 wCol = mix(uShallow, uDeep, wDeep);
float wAlpha = mix(0.18, 0.97, smoothstep(0.0, 1.0, wDeep));   // see the bottom in the shallows

// big, slow patches of lighter and darker water, so a flat seabed doesn't give one flat colour
float wPatch = fbm2(vWorldPos.xz * 0.11 + vec2(uTime * 0.02, uTime * 0.015));
wCol *= 0.8 + 0.4 * wPatch;

// foam lapping at the shore: bands that creep in and out, broken up by noise
float wProx = wDepth < 2.5 ? landProximity(vWorldPos.xz) : 0.0;   // skip the probing in open water
float wShore = clamp(1.0 - smoothstep(0.0, 1.1, wDepth) + wProx * 1.2, 0.0, 1.0);
float wN = fbm2(vWorldPos.xz * 1.7 + vec2(uTime * 0.12, -uTime * 0.07));
float wLap = 0.5 + 0.5 * sin((1.0 - wShore) * 9.0 - uTime * 1.3 + wN * 5.0);
float wFoam = wShore * smoothstep(0.28, 0.62, wN * 0.55 + wLap * 0.5 + wShore * 0.5);
wFoam += smoothstep(0.5, 0.78, wProx) * 0.7;   // a solid white lip right against the bank
// whitecaps: rare, and only where a tall crest meets a patch of "breaking" noise. The
// threshold itself wanders with the noise, so the caps never line up in rows.
float wBreak = fbm2(vWorldPos.xz * 0.45 + vec2(uTime * 0.05, 0.0));
wFoam += smoothstep(0.8 - 0.2 * uFoam + 0.25 * wBreak, 1.0, vCrest) * smoothstep(0.55, 0.8, fbm2(vWorldPos.xz * 3.1 + uTime * 0.2)) * 0.9;
wFoam = clamp(wFoam, 0.0, 1.0) * uFoam;
wCol = mix(wCol, vec3(0.94, 0.97, 1.0), wFoam);
wAlpha = max(wAlpha, wFoam);
diffuseColor = vec4(wCol, wAlpha);
`

// after three has worked out the surface normal: ripple it, then add the sky reflection
const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
vec2 wq = vWorldPos.xz;
// two layers of noise sliding in different directions = ripples that never repeat
vec2 wg = noiseGrad(wq * 2.2 + vec2(uTime * 0.33, uTime * 0.21))
        + 0.6 * noiseGrad(wq * 5.3 - vec2(uTime * 0.27, uTime * 0.38));
wg += uRain * rainRipples(wq, uTime);
float wCalm = 0.3 + 0.7 * smoothstep(0.0, 0.5, wDepth);   // flatter right at the shore
// the normal is in view space, so turn the ground-plane tilt into view space first
normal = normalize(normal + mat3(viewMatrix) * vec3(-wg.x, 0.0, -wg.y) * uRipple * 0.18 * wCalm);

// Fresnel: the shallower our viewing angle, the more the water acts like a mirror
float wFres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
float wMirror = clamp(wFres * uReflect * 1.3, 0.0, 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, uSky, wMirror);
diffuseColor.a = clamp(diffuseColor.a + wMirror * 0.6, 0.0, 1.0);
`

function patch(shader: WebGLProgramParametersWithUniforms, u: WaterUniforms) {
  Object.assign(shader.uniforms, u)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_HEADER}`)
    .replace('#include <beginnormal_vertex>', VERT_NORMAL)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += wDisp;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_HEADER}`)
    .replace('#include <color_fragment>', FRAG_COLOR)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
}

/** The water material, plus the uniforms to drive it. Dispose the material when done with it. */
export function createWaterMaterial() {
  const uniforms = createWaterUniforms()
  const material = new MeshStandardMaterial({
    transparent: true,
    depthWrite: false, // see the seabed through the shallows, not a cut-out
    roughness: 0.1, // shiny, so the sun makes sharp glints on the ripples
    metalness: 0,
  })
  material.onBeforeCompile = (shader) => patch(shader, uniforms)
  // every water material compiles the same program, so tell three to share it
  material.customProgramCacheKey = () => 'procedural-water-v1'
  return { material, uniforms }
}
