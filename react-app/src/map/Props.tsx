import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import {
  grassRange,
  height,
  islandXReach,
  makeRng,
  MAP_SIZE,
  type TerrainParams,
} from './noise'
import { snapToVoxelGrid, snapHeightToVoxelGrid } from './VoxelTerrain'

const forestNoise = new ImprovedNoise()

/** Size of the scatter pool. The Count control draws a prefix of it. */
export const MAX_TREES = 2000

type Tree = {
  pos: [number, number, number]
  rot: number
  scale: number
}

// STEP A — decide *where* the trees could go (pure data, seeded, no rendering).
// Always builds the full pool so the Count slider just changes how many of them
// are drawn, instead of re-running rejection sampling on every drag.
//
// `voxel`, when true, is for VoxelMap: it snaps each candidate to the exact
// grid VoxelTerrain samples (via the shared snap*ToVoxelGrid helpers) so a
// tree can never land where no block was actually rendered underneath it —
// the smooth height field and the voxel grid's coarser sampling can otherwise
// disagree right at the coastline, floating trees over open water.
function useTrees(
  params: TerrainParams,
  scatterSeed: number,
  voxel?: boolean,
): Tree[] {
  return useMemo(() => {
    const rng = makeRng(params.seed + 777 + scatterSeed * 131)
    // only sample where land can actually be — in island mode most of the map
    // is river, so scattering across the full square wastes nearly every try
    const xReach = islandXReach(params)
    const zReach = MAP_SIZE * 0.48
    const [minY, maxY] = grassRange(params)
    const out: Tree[] = []
    let tries = 0

    while (out.length < MAX_TREES && tries < MAX_TREES * 60) {
      tries++
      let x = (rng() - 0.5) * 2 * xReach
      let z = (rng() - 0.5) * 2 * zReach
      if (voxel) {
        // land on a point VoxelTerrain itself samples, not a nearby one that
        // happens to test differently
        x = snapToVoxelGrid(x)
        z = snapToVoxelGrid(z)
      }
      const h = height(x, z, params)

      if (h < minY || h > maxY) continue // grass band only

      const density = forestNoise.noise(x * 0.05, z * 0.05, params.seed) // -1..1
      if (rng() > (density + 1) / 2) continue // sparser where density is low

      // sit on the block's actual top face, not the smooth in-between height
      const y = voxel ? snapHeightToVoxelGrid(h) : h

      out.push({
        pos: [x, y, z],
        rot: rng() * Math.PI * 2,
        scale: 0.6 + rng() * 0.8,
      })
    }
    return out
  }, [params, scatterSeed, voxel])
}

// STEP B — draw them all in ONE draw call. `range` caps how many are rendered.
export function Props({
  params,
  count = 400,
  scatterSeed = 0,
  voxel = false,
}: {
  params: TerrainParams
  count?: number
  scatterSeed?: number
  /** Snap trees onto VoxelTerrain's grid — set when rendering inside VoxelMap. */
  voxel?: boolean
}) {
  const trees = useTrees(params, scatterSeed, voxel)

  return (
    <Instances limit={MAX_TREES} range={Math.min(count, trees.length)} castShadow>
      <coneGeometry args={[0.6, 2, 6]} />
      <meshStandardMaterial color="#5c7a53" roughness={1} />
      {trees.map((t, i) => (
        <Instance
          key={i}
          position={t.pos}
          rotation={[0, t.rot, 0]}
          scale={t.scale}
        />
      ))}
    </Instances>
  )
}
