import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { noise01, type TerrainParams } from './noise'
import { coastDistance, WORLD } from './world/shore'
import { islandWiden } from './world/region'

// pixels per side — the field is smooth, so this reads crisply in the inset
// while staying cheap to regenerate on every slider change
const TEX_W = 160
const TEX_H = Math.round((TEX_W * (WORLD.z1 - WORLD.z0)) / (WORLD.x1 - WORLD.x0))

// coastline overlay, so you can see which part of the field becomes the island
// (sRGB bytes — the texture is tagged sRGB, so no linear conversion here)
const COAST = [0xf1, 0x65, 0x65] // --accent-red, #f16565

/**
 * The noise equation drawn directly: a flat grayscale image of noise01()
 * (black = 0, white = 1) over the whole city, after shaping but before the
 * coastline, with the real shoreline traced on top.
 */
export function NoisePlane({ params }: { params: TerrainParams }) {
  const texture = useMemo(() => {
    const data = new Uint8Array(TEX_W * TEX_H * 4)
    const widen = islandWiden(params)
    const pixel = (WORLD.x1 - WORLD.x0) / TEX_W // world units per texture pixel

    for (let j = 0; j < TEX_H; j++) {
      // row 0 is the texture's bottom edge (v = 0), which this flat plane
      // puts at +z (south) — see the rotation on the mesh below
      const z = WORLD.z1 - ((j + 0.5) / TEX_H) * (WORLD.z1 - WORLD.z0)
      for (let i = 0; i < TEX_W; i++) {
        const x = WORLD.x0 + ((i + 0.5) / TEX_W) * (WORLD.x1 - WORLD.x0)
        const g = Math.round(noise01(x, z, params) * 255)
        const o = (j * TEX_W + i) * 4

        // within ~half a pixel of the real shoreline
        const onCoast = Math.abs(coastDistance(x, z, widen)) < 0.6 * pixel
        data[o] = onCoast ? COAST[0] : g
        data[o + 1] = onCoast ? COAST[1] : g
        data[o + 2] = onCoast ? COAST[2] : g
        data[o + 3] = 255
      }
    }

    const tex = new THREE.DataTexture(data, TEX_W, TEX_H)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [params])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(WORLD.x0 + WORLD.x1) / 2, 0, (WORLD.z0 + WORLD.z1) / 2]}
    >
      <planeGeometry args={[WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
