import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
  type InstancedMesh,
} from 'three'
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
import { SPECIES, SPECIES_NAMES } from './lsystem'
import { buildVariants } from './treeGeometry'

const forestNoise = new ImprovedNoise()

/** Size of the scatter pool. The Count control draws a prefix of it. */
export const MAX_TREES = 2000

/**
 * Unique shapes grown per species. Every tree in the forest is one of
 * SPECIES × VARIANTS shapes, then varied again per instance (spin, size,
 * girth, tint) — so the forest costs this many draw calls, not one per tree.
 */
const VARIANTS_PER_SPECIES = 6

type Tree = {
  i: number // position in the pool — `count` keeps the ones below it
  pos: [number, number, number]
  rot: number
  scale: number
  girth: number // sideways stretch, so two copies of a shape differ in build
  tint: number // brightness multiplier on the vertex colours
  variant: number // index into the flat SPECIES × VARIANTS geometry list
}

// Grown once, on first use, then shared by every <Props>. The recipe is
// seeded, so reloads grow the same variants.
let geometries: BufferGeometry[] | null = null
function treeGeometries(): BufferGeometry[] {
  geometries ??= SPECIES_NAMES.flatMap((n) =>
    buildVariants(SPECIES[n], VARIANTS_PER_SPECIES),
  )
  return geometries
}

// vertex colours carry the bark and leaf colours; double-sided for the leaf cards
const treeMaterial = new MeshStandardMaterial({
  vertexColors: true,
  side: DoubleSide,
  roughness: 1,
})

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
      // draw every random number for this candidate up front, whether or not
      // it's kept — then a terraform edit that accepts/rejects one spot
      // doesn't shift the sequence and reshuffle the rest of the forest
      let x = (rng() - 0.5) * 2 * xReach
      let z = (rng() - 0.5) * 2 * zReach
      const keepRoll = rng()
      const rot = rng() * Math.PI * 2
      const scale = 0.6 + rng() * 0.8
      const variantRoll = rng()
      const girth = 0.85 + rng() * 0.3
      const tint = 0.85 + rng() * 0.25
      if (voxel) {
        // land on a point VoxelTerrain itself samples, not a nearby one that
        // happens to test differently
        x = snapToVoxelGrid(x)
        z = snapToVoxelGrid(z)
      }
      const h = height(x, z, params)

      if (h < minY || h > maxY) continue // grass band only

      const density = forestNoise.noise(x * 0.05, z * 0.05, params.seed) // -1..1
      if (keepRoll > (density + 1) / 2) continue // sparser where density is low

      // sit on the block's actual top face, not the smooth in-between height
      const y = voxel ? snapHeightToVoxelGrid(h) : h

      // species forms stands: a slow noise field picks it, so neighbours match
      const sNoise = forestNoise.noise(x * 0.03 + 100, z * 0.03 + 100, params.seed)
      const species = sNoise < -0.12 ? 0 : sNoise < 0.12 ? 1 : 2
      const variant =
        species * VARIANTS_PER_SPECIES +
        Math.floor(variantRoll * VARIANTS_PER_SPECIES)

      out.push({ i: out.length, pos: [x, y, z], rot, scale, girth, tint, variant })
    }
    return out
  }, [params, scatterSeed, voxel])
}

// STEP B — draw them: one InstancedMesh per tree shape, so the whole forest is
// ~18 draw calls. `count` caps how many are drawn.
function ShapeInstances({
  geometry,
  capacity,
  trees,
}: {
  geometry: BufferGeometry
  capacity: number
  trees: Tree[]
}) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const c = new Color()
    trees.forEach((t, k) => {
      o.position.set(...t.pos)
      o.rotation.set(0, t.rot, 0)
      o.scale.set(t.scale * t.girth, t.scale, t.scale * t.girth)
      o.updateMatrix()
      mesh.setMatrixAt(k, o.matrix)
      mesh.setColorAt(k, c.setScalar(t.tint))
    })
    mesh.count = trees.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [trees])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, treeMaterial, Math.max(1, capacity)]}
      castShadow
      // instances are spread across the whole island; a bounding sphere cached
      // from the first few would cull the rest
      frustumCulled={false}
    />
  )
}

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
  const shapes = treeGeometries()

  // pool split by shape (each list stays in pool order)
  const byShape = useMemo(() => {
    const lists: Tree[][] = shapes.map(() => [])
    for (const t of trees) lists[t.variant].push(t)
    return lists
  }, [trees, shapes])

  // the Count slider keeps the first `count` of the pool
  const visible = useMemo(
    () => byShape.map((list) => list.filter((t) => t.i < count)),
    [byShape, count],
  )

  return (
    <group>
      {shapes.map((g, v) => (
        <ShapeInstances
          key={v}
          geometry={g}
          capacity={byShape[v].length}
          trees={visible[v]}
        />
      ))}
    </group>
  )
}
