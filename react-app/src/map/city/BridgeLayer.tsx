import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import { shapeKey, type TerrainParams } from '../noise'
import type { ScaleMode } from '../scale'
import { planBridges, type BridgePlan, type Part } from './bridges'

/**
 * THE BRIDGES, drawn. bridges.ts plans each crossing as a list of parts and says
 * when each appears; this builds a mesh per part and, as the Year changes, shows
 * and grows them: piers and towers rise from the bed, the deck is laid out from
 * both banks toward the middle, the cables are strung and the hangers hung.
 * (There are only a few hundred parts, so this runs on the CPU, once per change
 * of year.)
 */

const UNIT_BOX = new BoxGeometry(1, 1, 1)
const UP = new Vector3(0, 1, 0)
const basis = new Matrix4()
const xAxis = new Vector3()
const yAxis = new Vector3()
const zAxis = new Vector3()

/** Stretch the unit box into a beam from `from` to `to`, `thick` high and `wide` across. */
function place(mesh: Mesh, from: Vector3, to: Vector3, thick: number, wide: number) {
  xAxis.subVectors(to, from)
  const len = xAxis.length()
  xAxis.divideScalar(len || 1)
  // across the beam: horizontal, unless the beam is vertical
  if (Math.abs(xAxis.y) > 0.999) zAxis.set(0, 0, 1)
  else zAxis.crossVectors(xAxis, UP).normalize()
  yAxis.crossVectors(zAxis, xAxis)
  basis.makeBasis(xAxis, yAxis, zAxis)
  mesh.quaternion.setFromRotationMatrix(basis)
  mesh.position.addVectors(from, to).multiplyScalar(0.5)
  mesh.scale.set(Math.max(len, 0.001), thick, wide)
}

interface Built {
  plan: BridgePlan
  group: Group
  meshes: { part: Part; mesh: Mesh; from: Vector3; to: Vector3 }[]
  hangers: LineSegments | null
  /** The tramway's two cabins, which shuttle along the cables. */
  cabins: Mesh[]
}

const materials = new Map<string, MeshStandardMaterial>()
function material(color: string): MeshStandardMaterial {
  let mat = materials.get(color)
  if (!mat) {
    mat = new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15 })
    materials.set(color, mat)
  }
  return mat
}

function build(plan: BridgePlan): Built {
  const group = new Group()
  const meshes: Built['meshes'] = []
  for (const part of plan.parts) {
    const mesh = new Mesh(UNIT_BOX, material(part.color))
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.matrixAutoUpdate = true
    const from = new Vector3(...part.from)
    const to = new Vector3(...part.to)
    place(mesh, from, to, part.thick, part.wide)
    group.add(mesh)
    meshes.push({ part, mesh, from, to })
  }
  let hangers: LineSegments | null = null
  if (plan.hangers.length > 0) {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(plan.hangers.flat(), 3))
    hangers = new LineSegments(g, new LineBasicMaterial({ color: '#4a5055' }))
    hangers.frustumCulled = false
    group.add(hangers)
  }
  const cabins: Mesh[] = []
  if (plan.cabins) {
    for (let i = 0; i < 2; i++) {
      const cabin = new Mesh(UNIT_BOX, material('#c8372d'))
      cabin.scale.set(0.5, 0.45, 0.35)
      cabin.frustumCulled = false
      group.add(cabin)
      cabins.push(cabin)
    }
  }
  return { plan, group, meshes, hangers, cabins }
}

const tmp = new Vector3()

/** Show and grow each part for `year`. */
function update(b: Built, year: number) {
  const { plan } = b
  b.group.visible = year >= plan.start
  if (!b.group.visible) return
  // 0 when work starts … 1 when it opens
  const p = Math.min(1, Math.max(0, (year - plan.start) / Math.max(1, plan.built - plan.start)))
  for (const { part, mesh, from, to } of b.meshes) {
    const g = Math.min(1, Math.max(0, (p - part.appear) / part.span))
    mesh.visible = g > 0
    if (g > 0 && part.rise) {
      // grows up from its base
      tmp.lerpVectors(from, to, g)
      place(mesh, from, tmp, part.thick, part.wide)
    }
  }
  if (b.hangers) b.hangers.visible = p > 0.88
}

/**
 * The city's bridges and highways over the water, as they stand in `year`. They
 * follow the terrain (and the scale mode's heights), and are rebuilt only when
 * those change.
 */
export function Bridges({
  params,
  year,
  scaleMode = 'readable',
  show = true,
}: {
  params: TerrainParams
  year: number
  scaleMode?: ScaleMode
  show?: boolean
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plans = useMemo(() => planBridges(params, scaleMode), [scaleMode, ...shapeKey(params)])
  const built = useMemo(() => {
    const group = new Group()
    const all = plans.map(build)
    for (const b of all) group.add(b.group)
    return { group, all }
  }, [plans])
  useEffect(
    () => () => {
      for (const b of built.all) b.hangers?.geometry.dispose()
    },
    [built],
  )

  // the tramway's cabins shuttle back and forth, one up while the other is down
  useFrame((state) => {
    for (const b of built.all) {
      const path = b.plan.cabins
      if (!path || !b.group.visible || b.cabins.length === 0) continue
      const lens = [path[0], path[1], path[2]].map((p, i, a) => (i === 0 ? 0 : Math.hypot(p[0] - a[i - 1][0], p[2] - a[i - 1][2])))
      const total = lens[1] + lens[2]
      const phase = 0.5 - 0.5 * Math.cos(state.clock.elapsedTime * 0.35) // 0 → 1 → 0, easing at each end
      b.cabins.forEach((cabin, i) => {
        const d = (i === 0 ? phase : 1 - phase) * total
        const first = d < lens[1]
        const from = first ? path[0] : path[1]
        const to = first ? path[1] : path[2]
        const f = first ? d / lens[1] : (d - lens[1]) / lens[2]
        cabin.position.set(
          from[0] + (to[0] - from[0]) * f + (i === 0 ? -0.25 : 0.25),
          from[1] + (to[1] - from[1]) * f - 0.35,
          from[2] + (to[2] - from[2]) * f,
        )
      })
    }
  })

  // update the parts when the year (or the plan) changes, not every frame
  const last = useRef({ year: NaN, built: null as unknown })
  useFrame(() => {
    if (last.current.year === year && last.current.built === built) return
    last.current = { year, built }
    for (const b of built.all) update(b, year)
  })

  return <primitive object={built.group} visible={show} />
}
