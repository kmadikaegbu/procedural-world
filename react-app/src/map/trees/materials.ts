import { useEffect, useMemo } from 'react'
import {
  Color,
  DataTexture,
  DoubleSide,
  MeshDepthMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  RGBADepthPacking,
  ShaderChunk,
  type Material,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import type { SeasonLook } from './seasons'

/**
 * MATERIALS — how tree surfaces are shaded.
 *
 * Three looks share one set of colours (baked into each mesh as vertex colours
 * by geometry.ts):
 *   realistic  smooth lighting (MeshStandardMaterial)
 *   flat       the same, but each triangle lit as one flat facet
 *   toon       light snapped to 3 bands, like a cartoon (MeshToonMaterial)
 *
 * Every look also gets a small shader patch for SEASONS. Each vertex carries an
 * `aLeaf` number (set in geometry.ts):
 *    0      bark — never changed
 *    0..1   a leaf; the number is its "drop rank". Leaves whose rank is above
 *           the season's `keep` fraction are hidden (squashed to a point, so
 *           they cost nothing to draw). Low ranks stay on longest.
 *   −1      a far-away LOD3 blob (part leaf, part bark): recoloured, and faded
 *           toward bare-branch colour as the leaves drop, but never hidden
 * Leaves are also tinted toward the season's colour, keeping each one's own
 * light/dark variation. Because season only changes uniform VALUES (below),
 * switching season is instant — no tree is regrown, no shader recompiled.
 */

export type TreeLook = 'realistic' | 'flat' | 'toon'
export const TREE_LOOKS: TreeLook[] = ['realistic', 'flat', 'toon']

// Shared by every tree material, in every canvas: changing a value here
// changes all of them on the next frame.
const seasonUniforms = {
  uSeasonColor: { value: new Color('#6f8f4f') },
  uSeasonMix: { value: 0 },
  uLeafKeep: { value: 1 },
  uBareColor: { value: new Color('#5c5248') },
}

export function applySeason(s: SeasonLook) {
  seasonUniforms.uSeasonColor.value.set(s.tint)
  seasonUniforms.uSeasonMix.value = s.mix
  seasonUniforms.uLeafKeep.value = s.keep
  seasonUniforms.uBareColor.value.set(s.bare)
}

const HEADER = /* glsl */ `
attribute float aLeaf;
uniform vec3 uSeasonColor;
uniform float uSeasonMix;
uniform float uLeafKeep;
uniform vec3 uBareColor;
`

// after the vertex position is read: hide leaves the season has dropped
const DROP = /* glsl */ `
#include <begin_vertex>
if (aLeaf > 0.0 && aLeaf > uLeafKeep) transformed = vec3(0.0);
`

// before the per-tree tint is applied: recolour leaves for the season
const RECOLOR = /* glsl */ `
#ifdef USE_COLOR
if (aLeaf != 0.0) {
  // brightness of this leaf relative to an average leaf, so light and dark
  // leaves stay light and dark after the hue changes
  float lum = dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.18;
  float w = aLeaf < 0.0 ? 0.8 : 1.0; // a whole-tree blob is part bark
  vColor.rgb = mix(vColor.rgb, uSeasonColor * lum, uSeasonMix * w);
  if (aLeaf < 0.0) vColor.rgb = mix(vColor.rgb, uBareColor, (1.0 - uLeafKeep) * 0.85);
}
#endif
#ifdef USE_INSTANCING_COLOR`

// three's own colour chunk with our recolour spliced in just before it
// multiplies in the per-tree (instance) tint — so the LOD debug tint still
// shows on top of the season colour
const COLOR_VERTEX = ShaderChunk.color_vertex.replace('#ifdef USE_INSTANCING_COLOR', RECOLOR)

function patchSeason(shader: WebGLProgramParametersWithUniforms, recolor: boolean) {
  Object.assign(shader.uniforms, seasonUniforms)
  let vs = HEADER + shader.vertexShader.replace('#include <begin_vertex>', DROP)
  if (recolor) vs = vs.replace('#include <color_vertex>', COLOR_VERTEX)
  shader.vertexShader = vs
}

export interface TreeMaterials {
  /** For tree, ivy and fallen-leaf meshes. */
  material: Material
  /** For their shadows — without it, dropped leaves would still cast shadows. */
  depth: MeshDepthMaterial
}

function create(look: TreeLook): TreeMaterials {
  let material: MeshStandardMaterial | MeshToonMaterial
  if (look === 'toon') {
    // 3 brightness steps: shadow, mid, lit. Nearest filtering keeps the steps hard.
    const ramp = new DataTexture(new Uint8Array([90, 170, 255]), 3, 1, RedFormat)
    ramp.minFilter = ramp.magFilter = NearestFilter
    ramp.needsUpdate = true
    material = new MeshToonMaterial({ vertexColors: true, side: DoubleSide, gradientMap: ramp })
  } else {
    material = new MeshStandardMaterial({
      vertexColors: true,
      side: DoubleSide, // leaf cards are seen from both sides
      roughness: 1,
      flatShading: look === 'flat',
    })
  }
  material.onBeforeCompile = (shader) => patchSeason(shader, true)

  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  depth.onBeforeCompile = (shader) => patchSeason(shader, false)
  return { material, depth }
}

/** The materials for a look — made once per look, and disposed when the look changes. */
export function useTreeMaterials(look: TreeLook): TreeMaterials {
  const mats = useMemo(() => create(look), [look])
  useEffect(
    () => () => {
      const m = mats.material as MeshToonMaterial
      m.gradientMap?.dispose()
      m.dispose()
      mats.depth.dispose()
    },
    [mats],
  )
  return mats
}
