import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'
import { height, MAP_SIZE, type TerrainParams } from './noise'
import { makeRamp, biomeColor } from './biomes'

// World units per cube. Coarser than the smooth mesh's Resolution slider on
// purpose — each voxel is real instanced geometry, not a shaded vertex, so
// the count has to stay bounded. ~65 columns across the island's ~100-unit
// span is enough to read as "blocky Roosevelt Island" without melting the GPU.
export const VOXEL_SIZE = 1.5
// how many cubes to stack straight down from each column's surface. This is
// the simple version of "no gaps at cliffs": a real voxel engine would only
// draw exposed faces (greedy meshing / face culling) and could fill forever;
// here a fixed depth keeps the instance count bounded, so a cliff taller than
// this in one step could show a sliver of a gap. Fine for these rolling hills.
const FILL_DEPTH = 3

// drei's <Instances limit> allocates its instance buffers ONCE, on first
// mount — it is a fixed capacity, not a live prop. The actual per-frame count
// (which changes as terrain params change) must go through `range` instead,
// same as the tree pool in Props.tsx. This is a generous upper bound: worst
// case is every column rendered (no water to skip) at the grid size below.
const MAX_VOXELS = 16000

const COLS = Math.round(MAP_SIZE / VOXEL_SIZE)
const HALF = (COLS * VOXEL_SIZE) / 2

/**
 * Snaps an X or Z coordinate to the exact column lattice the loop below
 * samples (offset by half a cell from 0, not a plain multiple of VOXEL_SIZE).
 * Props.tsx uses this so a tree's (x, z) always lands on a point VoxelTerrain
 * itself tests — never in a gap between two grid points that individually
 * disagree with the smooth height field.
 */
export function snapToVoxelGrid(v: number): number {
  return Math.round((v + HALF) / VOXEL_SIZE) * VOXEL_SIZE - HALF
}

/** Snaps a height to the vertical voxel step — the block's actual top face. */
export function snapHeightToVoxelGrid(h: number): number {
  return Math.round(h / VOXEL_SIZE) * VOXEL_SIZE
}

type Voxel = { pos: [number, number, number]; color: THREE.Color }

export function VoxelTerrain({
  params,
  wireframe = false,
}: {
  params: TerrainParams
  wireframe?: boolean
}) {
  const voxels = useMemo(() => {
    const ramp = makeRamp(params.amplitude, params.seaLevel)
    const c = new THREE.Color()
    const out: Voxel[] = []

    for (let i = 0; i <= COLS; i++) {
      const x = -HALF + i * VOXEL_SIZE
      for (let j = 0; j <= COLS; j++) {
        const z = -HALF + j * VOXEL_SIZE
        const h = height(x, z, params)

        // fully submerged and not even near the shore — skip it, the water
        // plane covers it and it would otherwise be most of the grid
        if (h < params.seaLevel - VOXEL_SIZE) continue

        const surface = snapHeightToVoxelGrid(h)
        for (let k = 0; k < FILL_DEPTH; k++) {
          const y = surface - k * VOXEL_SIZE
          out.push({ pos: [x, y, z], color: biomeColor(y, ramp, c).clone() })
        }
      }
    }
    return out
  }, [params])

  return (
    <Instances limit={MAX_VOXELS} range={voxels.length} castShadow receiveShadow>
      <boxGeometry args={[VOXEL_SIZE * 0.94, VOXEL_SIZE * 0.94, VOXEL_SIZE * 0.94]} />
      <meshStandardMaterial roughness={0.95} metalness={0} wireframe={wireframe} />
      {voxels.map((v, i) => (
        <Instance key={i} position={v.pos} color={v.color} />
      ))}
    </Instances>
  )
}
