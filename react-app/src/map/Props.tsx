import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  Object3D,
  type InstancedMesh,
  type OrthographicCamera,
} from 'three'
import { height, type TerrainParams } from './noise'
import { snapToVoxelGrid, snapHeightToVoxelGrid } from './VoxelTerrain'
import {
  SCATTER_DEFAULTS,
  scatterTrees,
  type ScatterMask,
  type ScatterSettings,
} from './scatter'
import type { TreeSet } from './treeSet'
import { LOD_COUNT } from './treeGeometry'
import {
  LOD_COLORS,
  LOD_OFF,
  updateLevels,
  type LodReadout,
  type LodSettings,
} from './lod'

// vertex colours carry the bark and leaf colours; double-sided for the leaf cards
const treeMaterial = new MeshStandardMaterial({
  vertexColors: true,
  side: DoubleSide,
  roughness: 1,
})

// Scatter (scatter.ts) decides WHERE trees go; this file draws them. Every tree shape has one InstancedMesh per level of detail;
// each frame a tree is filed under whichever level its camera distance calls
// for (see lod.ts), and a mesh draws only the trees filed under it. With LOD
// off every tree is filed under level 0.

// Debug tint per level. Multiplies the vertex colours, so it's pushed past 1 to
// stay readable on dark bark.
const DEBUG_TINT = LOD_COLORS.map((c) => new Color(c).multiplyScalar(1.6))

const RING_SEGMENTS = 72
const RING_WIDTH = 0.6

/** Debug: a ring on the ground at each LOD switch distance, centred under the camera. */
function LodRings({
  params,
  thresholds,
}: {
  params: TerrainParams
  thresholds: readonly [number, number, number]
}) {
  const geometries = useMemo(
    () =>
      thresholds.map(() => {
        const g = new BufferGeometry()
        const verts = (RING_SEGMENTS + 1) * 2
        g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
        const idx: number[] = []
        for (let k = 0; k < RING_SEGMENTS; k++) {
          const a = k * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
        g.setIndex(idx)
        return g
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const last = useRef({ x: NaN, y: NaN, z: NaN, key: '', params, t: 0 })

  useFrame((state) => {
    const cam = state.camera.position
    const l = last.current
    const key = thresholds.join()
    const moved =
      Math.abs(cam.x - l.x) + Math.abs(cam.y - l.y) + Math.abs(cam.z - l.z) > 0.05 ||
      key !== l.key ||
      params !== l.params
    // ring heights come from the noise function, so don't redo them every frame
    if (!moved || state.clock.elapsedTime - l.t < 0.08) return
    Object.assign(l, { x: cam.x, y: cam.y, z: cam.z, key, params, t: state.clock.elapsedTime })

    // distance is measured in 3D, so the ground radius is what's left after the camera's height
    const dy = cam.y - height(cam.x, cam.z, params)
    thresholds.forEach((R, i) => {
      const r = Math.sqrt(Math.max(R * R - dy * dy, 0))
      const pos = geometries[i].getAttribute('position') as BufferAttribute
      for (let k = 0; k <= RING_SEGMENTS; k++) {
        const a = (k / RING_SEGMENTS) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const y = height(cam.x + c * r, cam.z + s * r, params) + 0.4
        pos.setXYZ(k * 2, cam.x + c * (r - RING_WIDTH / 2), y, cam.z + s * (r - RING_WIDTH / 2))
        pos.setXYZ(k * 2 + 1, cam.x + c * (r + RING_WIDTH / 2), y, cam.z + s * (r + RING_WIDTH / 2))
      }
      pos.needsUpdate = true
    })
  })

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} frustumCulled={false} renderOrder={10}>
          {/* ring i is the switch into level i+1, so it wears that level's colour */}
          <meshBasicMaterial color={LOD_COLORS[i + 1]} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

export function Props({
  params,
  treeSet,
  count = 400,
  scatterSeed = 0,
  voxel = false,
  scatter = SCATTER_DEFAULTS,
  mask = null,
  lod = LOD_OFF,
  onLodStats,
  onPlaced,
}: {
  params: TerrainParams
  /** The tree shapes to plant — grown by useTreeSet from the Props-tab settings. */
  treeSet: TreeSet
  count?: number
  scatterSeed?: number
  /** Snap trees onto VoxelTerrain's grid — set when rendering inside VoxelMap. */
  voxel?: boolean
  scatter?: ScatterSettings
  /** Painted planting zone — only used while `scatter.maskEnabled`. */
  mask?: ScatterMask | null
  lod?: LodSettings
  /** Called ~twice a second with tree/frame triangles, FPS and draw calls. */
  onLodStats?: (r: LodReadout) => void
  /** Called when the forest is re-scattered: trees drawn, and how many fit in all. */
  onPlaced?: (drawn: number, fit: number) => void
}) {
  const maskInUse = scatter.maskEnabled ? mask : null
  // The pool is every tree that fits the rules, up to MAX_TREES; Count draws a prefix.
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
  useLayoutEffect(() => {
    onPlaced?.(Math.min(count, trees.length), trees.length)
  }, [onPlaced, count, trees])
  const { shapes, mixed, variantsPerSpecies: V } = treeSet
  const S = shapes.length

  // Everything about a tree that doesn't change with the camera, packed flat so
  // the per-frame work is just array reads. A mixed forest keeps each species in
  // its own block of shapes; a single-species one uses them all.
  const pool = useMemo(() => {
    const n = trees.length
    const shapeOf = new Uint16Array(n)
    const positions = new Float32Array(n * 3)
    const matrices = new Float32Array(n * 16)
    const tints = new Float32Array(n)
    const capacity = new Int32Array(S)
    const o = new Object3D()
    o.rotation.order = 'YXZ' // spin about the trunk first, then lean
    trees.forEach((t, i) => {
      const shape = (mixed ? t.species * V : 0) + Math.floor(t.variantRoll * V)
      shapeOf[i] = shape
      capacity[shape]++
      positions.set(t.pos, i * 3)
      tints[i] = t.tint
      o.position.set(...t.pos)
      o.rotation.set(t.tiltX, t.yaw, t.tiltZ)
      o.scale.set(t.scale * t.girth, t.scale, t.scale * t.girth)
      o.updateMatrix()
      matrices.set(o.matrix.elements, i * 16)
    })
    return { n, shapeOf, positions, matrices, tints, capacity }
  }, [trees, S, mixed, V])

  const meshes = useRef<(InstancedMesh | null)[]>([])
  const levels = useRef(new Uint8Array(0))
  const live = useRef({ lod, count })
  const refresh = useRef(true) // re-pick every level + refill every mesh next frame
  const acc = useRef({ frames: 0, time: 0 })
  const lastLevels = useRef<number[]>([0, 0, 0, 0]) // trees per level, as of the last refill
  const lastTreeTris = useRef(0)
  const lastMeshes = useRef(0) // instanced meshes actually drawn = tree draw calls

  // anything that changes what should be drawn → start over from distances alone
  useLayoutEffect(() => {
    levels.current = new Uint8Array(pool.n)
    live.current = { lod, count }
    refresh.current = true
    acc.current = { frames: 0, time: 0 } // don't average FPS across a settings change
    for (const m of meshes.current) {
      // the per-instance colour buffer only exists once something has been written to it
      if (m && !m.instanceColor) m.setColorAt(0, DEBUG_TINT[0].clone().setScalar(1))
    }
  }, [pool, treeSet, lod, count])

  useFrame((state, delta) => {
    const p = pool
    const n = Math.min(live.current.count, p.n)
    const cfg = live.current.lod
    const lv = levels.current
    const cam = state.camera
    // an orthographic view (the 2D minimap) has no meaningful "distance" — draw it at full detail
    const active = cfg.enabled && !(cam as OrthographicCamera).isOrthographicCamera
    const fresh = refresh.current
    refresh.current = false

    let changed = fresh
    if (active) {
      changed =
        updateLevels(lv, p.positions, n, cam.position, cfg.thresholds, cfg.hysteresis, fresh) ||
        fresh
    } else if (fresh) {
      lv.fill(0)
    }

    let treeTris = 0
    let byLevel = lastLevels.current
    if (changed) {
      const filled = new Int32Array(S * LOD_COUNT)
      byLevel = new Array<number>(LOD_COUNT).fill(0)
      const showDebug = active && cfg.debug
      for (let i = 0; i < n; i++) {
        const shape = p.shapeOf[i]
        const level = lv[i]
        const slot = shape * LOD_COUNT + level
        const mesh = meshes.current[slot]
        if (!mesh) continue
        const k = filled[slot]++
        mesh.instanceMatrix.array.set(p.matrices.subarray(i * 16, i * 16 + 16), k * 16)
        const col = mesh.instanceColor!.array
        const tint = p.tints[i]
        const t = showDebug ? DEBUG_TINT[level] : null
        col[k * 3] = t ? t.r * tint : tint
        col[k * 3 + 1] = t ? t.g * tint : tint
        col[k * 3 + 2] = t ? t.b * tint : tint
        byLevel[level]++
        treeTris += shapes[shape].tris[level]
      }
      for (let slot = 0; slot < S * LOD_COUNT; slot++) {
        const mesh = meshes.current[slot]
        if (!mesh) continue
        mesh.count = filled[slot]
        mesh.visible = filled[slot] > 0 // a hidden mesh costs no draw call
        mesh.instanceMatrix.needsUpdate = true
        mesh.instanceColor!.needsUpdate = true
      }
      lastLevels.current = byLevel
      lastTreeTris.current = treeTris
      lastMeshes.current = filled.reduce((n, c) => n + (c > 0 ? 1 : 0), 0)
    }

    // report twice a second: tree-only triangles, whole-frame triangles, FPS
    const a = acc.current
    a.frames++
    a.time += delta
    if (onLodStats && a.time >= 0.5) {
      onLodStats({
        enabled: cfg.enabled,
        treeTris: lastTreeTris.current,
        frameTris: state.gl.info.render.triangles,
        fps: a.frames / a.time,
        byLevel: lastLevels.current,
        meshes: lastMeshes.current,
      })
      a.frames = 0
      a.time = 0
    }
  })

  return (
    <group>
      {shapes.flatMap((shape, s) =>
        shape.lods.map((g, l) => (
          <instancedMesh
            key={g.uuid} // a regrown shape is a new geometry → fresh mesh
            ref={(m) => {
              meshes.current[s * LOD_COUNT + l] = m
            }}
            args={[g, treeMaterial, Math.max(1, pool.capacity[s])]}
            castShadow
            visible={false}
            // instances are spread across the whole island; a bounding sphere
            // cached from the first few would cull the rest
            frustumCulled={false}
          />
        )),
      )}
      {lod.enabled && lod.debug && (
        <LodRings params={params} thresholds={lod.thresholds} />
      )}
    </group>
  )
}
