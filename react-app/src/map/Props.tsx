import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { grassRange, shapeKey, type TerrainParams } from './noise'
import { snapVoxelX, snapVoxelZ, snapHeightToVoxelGrid } from './VoxelTerrain'
import type { Forest } from './trees/forest'
import { FallenLeaves } from './trees/FallenLeaves'
import { LOD_COUNT } from './trees/geometry'
import { IvyMesh } from './trees/IvyMesh'
import { LOD_OFF, LodManager, packForest, type LodReadout } from './trees/lod'
import { LodRings } from './trees/LodRings'
import { applySeason, useTreeMaterials } from './trees/materials'
import { scatterTrees, treeMatrix, type PlacedTree } from './trees/scatter'
import { SEASONS } from './trees/seasons'
import { ratios } from './scale'

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
  const { treeSet, scatter, mask, count, scatterSeed, look, season, ivy, scaleMode } = forest
  // how much smaller objects are drawn than their readable size (1 = readable)
  const sizeRatio = ratios(scaleMode).objects
  const lod = main ? forest.lod : LOD_OFF

  const materials = useTreeMaterials(look)
  useEffect(() => applySeason(SEASONS[season]), [season])

  // WHERE: every spot on grass at any sea level the timeline reaches, up to
  // MAX_TREES. This depends on the SHAPE of the ground but not on sea level, so
  // the climate timeline can move the sea without re-scattering the forest.
  const maskInUse = scatter.maskEnabled ? mask : null
  const trees = useMemo(
    () =>
      scatterTrees(
        params,
        scatter,
        maskInUse,
        scatterSeed,
        voxel
          ? { x: snapVoxelX, z: snapVoxelZ, y: snapHeightToVoxelGrid }
          : undefined,
        scaleMode,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...shapeKey(params), scatter, maskInUse, scatterSeed, voxel, scaleMode],
  )
  // which of them are on grass at the CURRENT sea level, then the first `count`
  const [grassLo, grassHi] = grassRange(params)
  const visible = useMemo(
    () => trees.filter((t) => t.h >= grassLo && t.h <= grassHi),
    [trees, grassLo, grassHi],
  )
  // The sea level moves every frame on the climate timeline, but the trees it
  // picks only change when one crosses the grass band. Keep the same array until
  // then, so the leaves, ivy and LOD selection below don't rebuild for nothing.
  const lastDrawn = useRef<PlacedTree[]>([])
  const drawn = useMemo(() => {
    const next = visible.slice(0, count)
    const prev = lastDrawn.current
    if (next.length === prev.length && next.every((t, k) => t === prev[k])) return prev
    lastDrawn.current = next
    return next
  }, [visible, count])
  useLayoutEffect(() => {
    onPlaced?.(drawn.length, visible.length)
  }, [onPlaced, drawn, visible])

  // HOW MUCH detail: the manager owns the per-frame level picking. The pool
  // (and the meshes sized from it) is the WHOLE scatter, so sea level and Count
  // only change which of its trees are drawn, never the pool itself.
  const pool = useMemo(() => packForest(trees, treeSet, treeMatrix), [trees, treeSet])
  const manager = useMemo(() => new LodManager(), [])
  const acc = useRef({ frames: 0, time: 0 })
  useLayoutEffect(() => {
    manager.configure(pool, treeSet, lod)
    acc.current = { frames: 0, time: 0 } // don't average FPS across a settings change
  }, [manager, pool, treeSet, lod])
  // after configure, so a new pool always gets this selection too
  useLayoutEffect(() => {
    manager.select(Uint32Array.from(drawn, (t) => t.i))
  }, [manager, pool, drawn])

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
        sizeRatio={sizeRatio}
      />
      <IvyMesh
        params={params}
        trees={drawn}
        settings={ivy}
        seed={scatterSeed}
        materials={materials}
        sizeRatio={sizeRatio}
      />
      {lod.enabled && lod.debug && <LodRings params={params} thresholds={lod.thresholds} />}
    </group>
  )
}
