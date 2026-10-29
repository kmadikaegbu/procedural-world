import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  Color,
  Euler,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Material,
} from 'three'
import { height, type TerrainParams } from '../noise'
import { hash01 } from './grammar'
import type { PlacedTree } from './scatter'
import { SEASONS, type Season } from './seasons'

/**
 * Fallen leaves: small flat cards scattered on the ground under each tree —
 * none in spring, a carpet in autumn. One InstancedMesh for all of them.
 * Positions come from each tree's own seed, so they don't jump around when
 * the season changes, only appear or disappear.
 */
// the most fallen leaves drawn at once, however many trees there are
const MAX_FALLEN = 60000

export function FallenLeaves({
  trees,
  params,
  season,
  material,
  voxel,
  sizeRatio = 1,
}: {
  trees: PlacedTree[]
  params: TerrainParams
  season: Season
  material: Material
  voxel: boolean
  /** 1 at the readable scale; smaller at true scale, so leaves shrink with the trees. */
  sizeRatio?: number
}) {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(0.2, 0.13).rotateX(-Math.PI / 2)
    const n = g.getAttribute('position').count
    // the tree material reads per-vertex colour and the season "aLeaf" flag:
    // plain white (the per-leaf colour comes from the instance) and 0 (= not a leaf on a tree)
    g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).fill(1), 3))
    g.setAttribute('aLeaf', new BufferAttribute(new Float32Array(n), 1))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const look = SEASONS[season]
  const data = useMemo(() => {
    // cap the total, so a city-sized forest doesn't mean hundreds of thousands of leaves
    const per = Math.min(look.fallenPerTree, Math.floor(MAX_FALLEN / Math.max(trees.length, 1)))
    const total = trees.length * per
    const matrices = new Float32Array(total * 16)
    const colors = new Float32Array(total * 3)
    const palette = look.fallenColors.map((c) => new Color(c))
    const m = new Matrix4()
    const q = new Quaternion()
    const e = new Euler()
    const p = new Vector3()
    const s = new Vector3()
    let k = 0
    for (const t of trees) {
      for (let j = 0; j < per; j++) {
        const r = (n: number) => hash01(t.seed, 300 + j * 8 + n)
        // within the crown's footprint, denser near the trunk
        const a = r(0) * Math.PI * 2
        const d = Math.sqrt(r(1)) * 1.3 * t.scale
        const x = t.pos[0] + Math.cos(a) * d
        const z = t.pos[2] + Math.sin(a) * d
        const y = (voxel ? t.pos[1] : height(x, z, params)) + 0.03
        e.set((r(2) - 0.5) * 0.4, r(3) * Math.PI * 2, (r(4) - 0.5) * 0.4)
        m.compose(p.set(x, y, z), q.setFromEuler(e), s.setScalar((0.7 + r(5) * 0.6) * sizeRatio))
        matrices.set(m.elements, k * 16)
        const c = palette[Math.floor(r(6) * palette.length)]
        const shade = 0.8 + r(7) * 0.3
        colors.set([c.r * shade, c.g * shade, c.b * shade], k * 3)
        k++
      }
    }
    return { total, matrices, colors }
  }, [trees, look, params, voxel, sizeRatio])

  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh || !data.total) return
    mesh.instanceMatrix.array.set(data.matrices)
    if (!mesh.instanceColor) mesh.setColorAt(0, new Color(1, 1, 1))
    mesh.instanceColor!.array.set(data.colors)
    mesh.count = data.total
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
  }, [data])

  if (!data.total) return null
  return (
    <instancedMesh
      key={data.total} // a different number of leaves needs a differently sized mesh
      ref={ref}
      args={[geometry, undefined, data.total]}
      material={material}
      receiveShadow
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
