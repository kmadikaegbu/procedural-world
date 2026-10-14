import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { TerrainParams } from './noise'
import { snapToVoxelGrid, snapHeightToVoxelGrid } from './VoxelTerrain'
import type { Forest } from './trees/forest'
import { FallenLeaves } from './trees/FallenLeaves'
import { LOD_COUNT } from './trees/geometry'
import { IvyMesh } from './trees/IvyMesh'
import { LOD_OFF, LodManager, packForest, type LodReadout } from './trees/lod'
import { LodRings } from './trees/LodRings'
import { applySeason, useTreeMaterials } from './trees/materials'
import { scatterTrees, treeMatrix } from './trees/scatter'
import { SEASONS } from './trees/seasons'

/**
 * The forest layer of the map. The work is done by the modules in ./trees:
 *
 *   scatter.ts   WHERE trees go (and each one's own seed)
 *   treeSet      WHAT they look like (shapes grown from the L-system, 4 LODs each)
 *   lod.ts       HOW MUCH detail each gets this frame, filed into instanced meshes
 *
 * This component wires them together and draws the result, plus the fallen
 * leaves, ivy and LOD debug rings.
 */
export function Props({
  params,
  forest,
  voxel = false,
  main = false,
  onLodStats,
  onPlaced,
}: {
  params: TerrainParams
  forest: Forest
  /** Snap trees onto VoxelTerrain's grid — set when rendering inside VoxelMap. */
  voxel?: boolean
  /** The main 3D view (LOD, debug rings and stats apply) — not the minimap. */
  main?: boolean
  /** Called ~twice a second with tree/frame triangles, FPS and draw calls. */
  onLodStats?: (r: LodReadout) => void
  /** Called when the forest is re-scattered: trees drawn, and how many fit in all. */
  onPlaced?: (drawn: number, fit: number) => void
}) {
  const { treeSet, scatter, mask, count, scatterSeed, look, season, ivy } = forest
  const lod = main ? forest.lod : LOD_OFF

  const materials = useTreeMaterials(look)
  useEffect(() => applySeason(SEASONS[season]), [season])

  // WHERE: every spot that fits the rules, up to MAX_TREES; Count draws a prefix
  const maskInUse = scatter.maskEnabled ? mask : null
  const trees = useMemo(
    () =>
      scatterTrees(
        params,
        scatter,
        maskInUse,
        scatterSeed,
        voxel ? { xz: snapToVoxelGrid, y: snapHeightToVoxelGrid } : undefined,
      ),
    [params, scatter, maskInUse, scatterSeed, voxel],
  )
  const drawn = useMemo(() => trees.slice(0, count), [trees, count])
  useLayoutEffect(() => {
    onPlaced?.(drawn.length, trees.length)
  }, [onPlaced, drawn, trees])

  // HOW MUCH detail: the manager owns the per-frame level picking
  const pool = useMemo(() => packForest(trees, treeSet, treeMatrix), [trees, treeSet])
  const manager = useMemo(() => new LodManager(), [])
  const acc = useRef({ frames: 0, time: 0 })
  useLayoutEffect(() => {
    manager.configure(pool, treeSet, lod, count)
    acc.current = { frames: 0, time: 0 } // don't average FPS across a settings change
  }, [manager, pool, treeSet, lod, count])

  useFrame((state, delta) => {
    manager.update(state.camera)

    // report twice a second: tree-only triangles, whole-frame triangles, FPS
    if (!onLodStats) return
    const a = acc.current
    a.frames++
    a.time += delta
    if (a.time < 0.5) return
    onLodStats({
      enabled: lod.enabled,
      treeTris: manager.treeTris,
      frameTris: state.gl.info.render.triangles,
      fps: a.frames / a.time,
      byLevel: manager.byLevel,
      meshes: manager.drawCalls,
    })
    a.frames = 0
    a.time = 0
  })

  return (
    <group>
      {/* one InstancedMesh per (shape, level) — the manager fills them each frame */}
      {treeSet.shapes.flatMap((shape, s) =>
        shape.lods.map((g, l) => (
          <instancedMesh
            key={g.uuid} // a regrown shape is a new geometry → fresh mesh
            ref={(m) => {
              manager.meshes[s * LOD_COUNT + l] = m
            }}
            args={[g, undefined, Math.max(1, pool.capacity[s])]}
            material={materials.material}
            customDepthMaterial={materials.depth}
            castShadow
            visible={false}
            // instances are spread across the whole island; a bounding sphere
            // cached from the first few would cull the rest
            frustumCulled={false}
            raycast={() => null} // trees are never a brush target
          />
        )),
      )}
      <FallenLeaves
        trees={drawn}
        params={params}
        season={season}
        material={materials.material}
        voxel={voxel}
      />
      <IvyMesh params={params} trees={drawn} settings={ivy} seed={scatterSeed} materials={materials} />
      {lod.enabled && lod.debug && <LodRings params={params} thresholds={lod.thresholds} />}
    </group>
  )
}
