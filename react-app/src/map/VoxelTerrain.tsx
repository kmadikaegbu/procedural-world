import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { height, shapeKey, type TerrainParams } from './noise'
import { makeRamp, landColor } from './biomes'
import { islandWeight, islandWiden } from './world/region'
import { WORLD } from './world/shore'
import { GroundCollider } from './GroundCollider'
import { GRASS_DEFAULTS, type GrassSettings } from './grass/settings'

// World units per cube (~84 m). The whole city is ~250 × 300 columns, so each
// cube is real instanced geometry, not a shaded vertex, and the count has to
// stay bounded; this is fine enough that Roosevelt Island is several blocks wide.
export const VOXEL_SIZE = 2.5
// how many cubes to stack straight down from each column's surface. This is
// the simple version of "no gaps at cliffs": a real voxel engine would only
// draw exposed faces (greedy meshing / face culling) and could fill forever;
// here a fixed depth keeps the instance count bounded, so a cliff taller than
// this in one step could show a sliver of a gap. Fine for these rolling hills.
const FILL_DEPTH = 3

// the columns' lattice, anchored at the map's north-west corner
const COLS_X = Math.ceil((WORLD.x1 - WORLD.x0) / VOXEL_SIZE)
const COLS_Z = Math.ceil((WORLD.z1 - WORLD.z0) / VOXEL_SIZE)
const colX = (i: number) => WORLD.x0 + (i + 0.5) * VOXEL_SIZE
const colZ = (j: number) => WORLD.z0 + (j + 0.5) * VOXEL_SIZE

/**
 * Snap an X or Z coordinate to the centre of the nearest voxel column — the
 * exact lattice the loop below samples. trees/scatter.ts uses these so a tree's
 * (x, z) always lands on a point VoxelTerrain itself tests, never in a gap
 * between two grid points that individually disagree with the smooth height field.
 */
export function snapVoxelX(v: number): number {
  const i = Math.min(COLS_X - 1, Math.max(0, Math.floor((v - WORLD.x0) / VOXEL_SIZE)))
  return colX(i)
}
export function snapVoxelZ(v: number): number {
  const j = Math.min(COLS_Z - 1, Math.max(0, Math.floor((v - WORLD.z0) / VOXEL_SIZE)))
  return colZ(j)
}

/** Snaps a height to the vertical voxel step — the block's actual top face. */
export function snapHeightToVoxelGrid(h: number): number {
  return Math.round(h / VOXEL_SIZE) * VOXEL_SIZE
}

type Column = { x: number; z: number; surface: number; green: number }

const boxGeometry = new THREE.BoxGeometry(
  VOXEL_SIZE * 0.94,
  VOXEL_SIZE * 0.94,
  VOXEL_SIZE * 0.94,
)

/**
 * The whole city as blocks: one InstancedMesh with a cube per (column, depth).
 */
export function VoxelTerrain({
  params,
  grass = GRASS_DEFAULTS,
  wireframe = false,
}: {
  params: TerrainParams
  grass?: GrassSettings
  wireframe?: boolean
}) {
  // SHAPE: which columns exist and how tall they are. Not sea level — that only
  // decides which of them are drawn and what colour they are.
  const columns = useMemo(() => {
    const widen = islandWiden(params)
    const out: Column[] = []
    for (let j = 0; j < COLS_Z; j++) {
      const z = colZ(j)
      for (let i = 0; i < COLS_X; i++) {
        const x = colX(i)
        out.push({
          x,
          z,
          surface: snapHeightToVoxelGrid(height(x, z, params)),
          green: islandWeight(x, z, widen),
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, shapeKey(params))

  // which cubes are drawn, and their colours (this changes with sea level)
  const cubes = useMemo(() => {
    const ramp = makeRamp(params.amplitude, params.seaLevel)
    const c = new THREE.Color()
    const keep = params.seaLevel - VOXEL_SIZE
    const pos: number[] = []
    const col: number[] = []
    for (const column of columns) {
      // fully submerged and not even near the shore — skip it, the water plane
      // covers it and it would otherwise be most of the grid
      if (column.surface < keep) continue
      // parkland on the island (and everywhere while Paving is 0), paved grey elsewhere
      const green = Math.max(1 - grass.paving, column.green)
      for (let k = 0; k < FILL_DEPTH; k++) {
        const y = column.surface - k * VOXEL_SIZE
        landColor(y, ramp, green, c)
        pos.push(column.x, y, column.z)
        col.push(c.r, c.g, c.b)
      }
    }
    return { pos, col, count: pos.length / 3 }
  }, [columns, params.amplitude, params.seaLevel, grass.paving])

  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    for (let n = 0; n < cubes.count; n++) {
      o.position.set(cubes.pos[n * 3], cubes.pos[n * 3 + 1], cubes.pos[n * 3 + 2])
      o.updateMatrix()
      mesh.setMatrixAt(n, o.matrix)
      mesh.setColorAt(n, c.setRGB(cubes.col[n * 3], cubes.col[n * 3 + 1], cubes.col[n * 3 + 2]))
    }
    mesh.count = cubes.count
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cubes])

  return (
    <group>
      <instancedMesh
        // a different number of cubes needs a differently sized mesh
        key={Math.ceil(cubes.count / 4096)}
        ref={ref}
        args={[boxGeometry, undefined, Math.ceil(cubes.count / 4096) * 4096]}
        castShadow
        receiveShadow
        frustumCulled={false}
        // ~200,000 cubes would make every brush move slow; the collider below stands in
        raycast={() => null}
      >
        <meshStandardMaterial roughness={0.95} metalness={0} wireframe={wireframe} />
      </instancedMesh>
      <GroundCollider params={params} />
    </group>
  )
}
