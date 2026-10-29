import {
  Color,
  MeshStandardMaterial,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { NOISE_GLSL } from '../glsl/noise'
import { BANDS } from '../noise'

/**
 * TERRAIN MATERIAL WITH PROCEDURAL GRASS
 *
 * The terrain already gets a colour per vertex from its height (water → sand →
 * grass → rock → snow, see biomes.ts). Vertices are ~17 m apart, so on its own
 * that gives flat colour with edges that follow contour lines exactly.
 *
 * This shader works per PIXEL instead, but only where the ground is grass. For
 * each pixel it:
 *
 *   0. only on parkland: land is green except where the Paving setting turns it
 *      into paved city (Roosevelt Island always stays green)
 *   1. decides "is this grass?" from the height, with noise added so the edges
 *      with sand and rock wander like a real meadow's
 *   2. works out MOISTURE: wetter low down near the river, drier up high, with
 *      patches at two sizes (~100 m and ~20 m) — then picks a colour between
 *      dry straw and lush green
 *   3. shifts the colour for the SEASON (the same control the trees use)
 *   4. adds fine GRAIN in both colour and lighting, so it has texture up close
 *   5. thins STEEP SLOPES out to bare soil
 *   6. rolls WIND SHEEN across it: bands of light and dark, like wind on a field
 *   7. darkens and adds shine when it's been RAINING
 *   8. fades out under SNOW, so the snow coat still covers it
 *
 * Everything else (sand, rock, riverbed, snow) keeps the vertex colours as before.
 */

export interface GrassUniforms {
  uTime: { value: number }
  uSea: { value: number }
  uAmp: { value: number }
  /** sand, grass, rock band tops as a fraction of amplitude (see noise.ts BANDS) */
  uBands: { value: Vector3 }
  uLush: { value: number }
  uPatch: { value: number }
  uDetail: { value: number }
  uSheen: { value: number }
  uBare: { value: number }
  uWind: { value: number }
  uWet: { value: number }
  uSnow: { value: number }
  uPaving: { value: number }
  uLushColor: { value: Color }
  uDryColor: { value: Color }
  uSoilColor: { value: Color }
  uSeasonTint: { value: Color }
  uSeasonMix: { value: number }
  uSeasonDry: { value: number }
}

function createUniforms(): GrassUniforms {
  return {
    uTime: { value: 0 },
    uSea: { value: 0 },
    uAmp: { value: 4 },
    uBands: { value: new Vector3(BANDS.sand, BANDS.grass, BANDS.rock) },
    uLush: { value: 0.6 },
    uPatch: { value: 0.6 },
    uDetail: { value: 0.5 },
    uSheen: { value: 0.5 },
    uBare: { value: 0.5 },
    uWind: { value: 1.5 },
    uWet: { value: 0 },
    uSnow: { value: 0 },
    uPaving: { value: 0 },
    uLushColor: { value: new Color('#4f8a3a') },
    uDryColor: { value: new Color('#b3a45e') },
    uSoilColor: { value: new Color('#7a6248') },
    uSeasonTint: { value: new Color('#4f8a3a') },
    uSeasonMix: { value: 0 },
    uSeasonDry: { value: 0 },
  }
}

// --- vertex stage: hand the fragment stage the world position and normal ------

const VERT_HEADER = /* glsl */ `
attribute float aIsland;   // 1 on Roosevelt Island (always parkland), 0 elsewhere
uniform float uPaving;     // 0 = all land is parkland … 1 = paved city
varying float vGreen;
varying vec3 vGPos;
varying vec3 vGNormal;
`
const VERT_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
vGNormal = normalize(mat3(modelMatrix) * objectNormal);
`
const VERT_POS = /* glsl */ `
#include <begin_vertex>
vGPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vGreen = max(1.0 - uPaving, aIsland);
`

// --- fragment stage -----------------------------------------------------------

const FRAG_HEADER = /* glsl */ `
uniform float uTime;
uniform float uSea;
uniform float uAmp;
uniform vec3 uBands;
uniform float uLush;
uniform float uPatch;
uniform float uDetail;
uniform float uSheen;
uniform float uBare;
uniform float uWind;
uniform float uWet;
uniform float uSnow;
uniform vec3 uLushColor;
uniform vec3 uDryColor;
uniform vec3 uSoilColor;
uniform vec3 uSeasonTint;
uniform float uSeasonMix;
uniform float uSeasonDry;
varying float vGreen;
varying vec3 vGPos;
varying vec3 vGNormal;
${NOISE_GLSL}
`

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
float gA = max(uAmp, 0.01);
vec2 gp = vGPos.xz;
float gN1 = fbm2(gp * 0.33);          // big patches, ~3 units (~100 m) across
float gN2 = fbm2(gp * 1.7 + 11.0);     // small clumps, ~0.6 units (~20 m)

// 1. is this grass? Same height bands as the biome colours, but the height is
//    nudged by noise first, so the edges wander instead of tracing contour lines
float gH = vGPos.y + (gN2 - 0.5) * 0.14 * gA;
float gLo = uSea + uBands.x * gA;      // top of the sand
// The biome colours fade grass → rock above the grass band's top; the lower part
// of that fade still reads as grass (it's where this island's flat top sits), so
// grass runs 75% of the way into it before giving way to rock.
float gHi = uSea + (uBands.y + 0.75 * (uBands.z - uBands.y)) * gA;
float gW = smoothstep(gLo - 0.02 * gA, gLo + 0.06 * gA, gH)
         * (1.0 - smoothstep(gHi - 0.04 * gA, gHi + 0.03 * gA, gH));
gW *= vGreen;                           // only parkland — the rest of the city is paved

// 2. moisture: 1 = lush, 0 = parched. Low ground near the river holds water,
//    high ground drains and dries; patches at two sizes break it up
float gUp = clamp((vGPos.y - gLo) / max(gHi - gLo, 1e-3), 0.0, 1.0);
float gMoist = uLush + 0.3 - gUp * 0.35
             + (gN1 - 0.5) * 1.2 * uPatch
             + (gN2 - 0.5) * 0.5 * uPatch
             - uSeasonDry;
vec3 gCol = mix(uDryColor, uLushColor, clamp(gMoist, 0.0, 1.0));

// 3. season: shift the hue, keep each spot's light/dark
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float gLum = dot(gCol, LUMA);
gCol = mix(gCol, uSeasonTint * (gLum / max(dot(uSeasonTint, LUMA), 1e-3)), uSeasonMix);

// 4. fine grain: mottling at ~5 m and ~2 m
gCol *= 1.0 + (vnoise(gp * 7.0) - 0.5) * 0.35 * uDetail
            + (vnoise(gp * 19.0) - 0.5) * 0.2 * uDetail;

// 5. steep slopes thin out to bare soil (vGNormal.y is 1 on flat ground, 0 on a cliff)
float gSlope = 1.0 - clamp(vGNormal.y, 0.0, 1.0);
float gBareAt = mix(0.7, 0.18, uBare);
float gBareW = smoothstep(gBareAt - 0.08, gBareAt + 0.1, gSlope + (gN2 - 0.5) * 0.15);
gCol = mix(gCol, uSoilColor * (0.85 + 0.3 * gN2), gBareW);

// 6. wind sheen: wind flattens grass in moving bands, which catch the light
//    differently. They travel along +x, the same way the rain drifts.
float gGust = clamp(uWind / 4.0, 0.0, 1.0);
float gBand = sin(dot(gp, vec2(1.0, 0.3)) * 1.3 - uTime * (0.6 + uWind * 0.5) + gN1 * 5.0);
gCol *= 1.0 + gBand * 0.09 * uSheen * gGust * (1.0 - gBareW);

// 7. wet grass is darker
gCol *= 1.0 - 0.2 * uWet;

// 8. apply only on grass, and not under snow
float gMix = gW * (1.0 - uSnow);
diffuseColor.rgb = mix(diffuseColor.rgb, gCol, gMix);

// 9. the built-up city: a faint street grid, turned 29° like Manhattan's real
//    one (avenues run north-north-east), with each block a slightly different
//    tone. It only shows on built ground above the waterline, and fades out with
//    distance — a pattern this fine would just shimmer from far away.
float gAbove = smoothstep(uSea + 0.005 * gA, uSea + 0.075 * gA, vGPos.y);   // relative to the terrain height, so it holds at any scale
float gUrban = (1.0 - vGreen) * gAbove * (1.0 - uSnow);
if (gUrban > 0.0) {
  vec2 aveDir = vec2(0.4848, -0.8746);          // along the avenues (x east, z south)
  vec2 stDir = vec2(0.8746, 0.4848);            // along the cross streets
  float a = dot(gp, aveDir) / 2.4;              // cross streets are ~80 m apart
  float b = dot(gp, stDir) / 5.8;               // avenues are ~190 m apart
  vec2 cell = floor(vec2(a, b));
  float block = wHash(cell + 17.0);             // tone for this block
  float la = abs(fract(a) - 0.5);
  float lb = abs(fract(b) - 0.5);
  float street = max(smoothstep(0.43, 0.5, la), smoothstep(0.455, 0.5, lb));
  float near = 1.0 - smoothstep(60.0, 260.0, length(vViewPosition));
  float tone = 1.0 + (block - 0.5) * 0.16 * (0.4 + 0.6 * near) - street * 0.26 * near;
  tone *= 0.96 + 0.08 * fbm2(gp * 0.8);         // broad drifting of tone, so it isn't a flat sheet
  diffuseColor.rgb *= mix(1.0, tone, gUrban);
}
`

// wet grass is shinier
const FRAG_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.45, uWet * gMix);
`

// fine grain in the lighting too: tilt the surface normal by the noise's slope
const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
vec2 gG = noiseGrad(vGPos.xz * 7.0) * 0.6 + noiseGrad(vGPos.xz * 19.0) * 0.4;
normal = normalize(normal + mat3(viewMatrix) * vec3(-gG.x, 0.0, -gG.y) * 0.08 * uDetail * gMix);
`

function patch(shader: WebGLProgramParametersWithUniforms, u: GrassUniforms) {
  Object.assign(shader.uniforms, u)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_HEADER}`)
    .replace('#include <beginnormal_vertex>', VERT_NORMAL)
    .replace('#include <begin_vertex>', VERT_POS)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAG_HEADER}`)
    .replace('#include <color_fragment>', FRAG_COLOR)
    .replace('#include <roughnessmap_fragment>', FRAG_ROUGHNESS)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
}

/** The terrain material (vertex-coloured biomes + procedural grass). Dispose when done. */
export function createTerrainMaterial() {
  const uniforms = createUniforms()
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  })
  material.onBeforeCompile = (shader) => patch(shader, uniforms)
  material.customProgramCacheKey = () => 'procedural-grass-v1'
  return { material, uniforms }
}
