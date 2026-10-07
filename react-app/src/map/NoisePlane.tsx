import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { islandMask, MAP_SIZE, noise01, type TerrainParams } from './noise'

// pixels per side — the field is smooth, so this reads crisply in the inset
// while staying cheap to regenerate on every slider change
const TEX_SIZE = 160

// coastline overlay, so you can see which part of the field becomes the island
// (sRGB bytes — the texture is tagged sRGB, so no linear conversion here)
const COAST = [0xf1, 0x65, 0x65] // --accent-red, #f16565

/**
 * The noise equation drawn directly: a flat grayscale image of noise01()
 * (black = 0, white = 1) over the whole map, after shaping but before the
 * island mask. With the island on, the coastline is traced on top.
 */
export function NoisePlane({ params }: { params: TerrainParams }) {
  const texture = useMemo(() => {
    const data = new Uint8Array(TEX_SIZE * TEX_SIZE * 4)
    const half = MAP_SIZE / 2

    for (let j = 0; j < TEX_SIZE; j++) {
      // row 0 is the texture's bottom edge (v = 0), which this flat plane
      // puts at +z (south) — see the rotation on the mesh below
      const z = half - ((j + 0.5) / TEX_SIZE) * MAP_SIZE
      for (let i = 0; i < TEX_SIZE; i++) {
        const x = -half + ((i + 0.5) / TEX_SIZE) * MAP_SIZE
        const g = Math.round(noise01(x, z, params) * 255)
        const o = (j * TEX_SIZE + i) * 4

        const m = params.island ? islandMask(x, z, params) : 0
        const onCoast = params.island && m > 0.35 && m < 0.65
        data[o] = onCoast ? COAST[0] : g
        data[o + 1] = onCoast ? COAST[1] : g
        data[o + 2] = onCoast ? COAST[2] : g
        data[o + 3] = 255
      }
    }

    const tex = new THREE.DataTexture(data, TEX_SIZE, TEX_SIZE)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [params])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}
