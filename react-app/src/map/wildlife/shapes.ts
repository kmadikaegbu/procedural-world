import {
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AgentState, Species } from './sim'

/**
 * Animal bodies, each 1 unit long (the birds, 1 unit from wingtip to wingtip),
 * facing +z, feet at y = 0. They're scaled to each animal's real size when drawn.
 *
 * Each body is built from smooth parts (stretched spheres, tapered limbs,
 * cones) with its own colours painted on the vertices (a pale belly, dark legs,
 * a white tail tip). Every vertex also carries a few weights that say how it
 * moves, so the GPU can animate the animal with no per-frame work on the CPU:
 *
 *   leg    0 at the hip … 1 at the hoof: how far the vertex swings in a stride
 *   phase  which diagonal pair of legs it belongs to (0 or π)
 *   head   how much the vertex follows the head when it dips to graze
 *   wing   0 at the shoulder … 1 at the wingtip: how far it flaps
 *   flag   1 for antlers, which only some deer have
 *
 * The animation itself is in wildlife/Wildlife.tsx (the material's shader).
 */

type V3 = [number, number, number]

interface Paint {
  /** A flat colour, or a colour that depends on where the vertex is. */
  color: V3 | ((x: number, y: number, z: number) => V3)
  /** [hip height, foot height]: the part is a leg, swinging more toward the foot. */
  leg?: [number, number]
  phase?: number
  head?: (x: number, y: number, z: number) => number
  wing?: boolean
  flag?: number
}

const hex = (c: string): V3 => [
  parseInt(c.slice(1, 3), 16) / 255,
  parseInt(c.slice(3, 5), 16) / 255,
  parseInt(c.slice(5, 7), 16) / 255,
]
const mix = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Colours from `belly` at height y0 up to `back` at y1: lighter underneath, like most animals. */
const shaded = (belly: V3, back: V3, y0: number, y1: number) => (_x: number, y: number) =>
  mix(belly, back, clamp01((y - y0) / (y1 - y0)))

/** Bake colours and motion weights into a part's vertices, and make it flat-triangle (mergeable). */
function paint(g: BufferGeometry, p: Paint): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  out.deleteAttribute('uv')
  const pos = out.getAttribute('position')
  const n = pos.count
  const color = new Float32Array(n * 3)
  const part = new Float32Array(n * 4)
  const flag = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const c = typeof p.color === 'function' ? p.color(x, y, z) : p.color
    color.set(c, i * 3)
    if (p.leg) part[i * 4] = Math.pow(clamp01((p.leg[0] - y) / (p.leg[0] - p.leg[1])), 1.2)
    part[i * 4 + 1] = p.phase ?? 0
    if (p.head) part[i * 4 + 2] = clamp01(p.head(x, y, z))
    if (p.wing) part[i * 4 + 3] = clamp01(Math.abs(x) / 0.5)
    flag[i] = p.flag ?? 0
  }
  out.setAttribute('color', new Float32BufferAttribute(color, 3))
  out.setAttribute('aPart', new Float32BufferAttribute(part, 4))
  out.setAttribute('aFlag', new Float32BufferAttribute(flag, 1))
  return out
}

/** A stretched sphere: radii (rx, ry, rz) at (x, y, z). */
function blob(rx: number, ry: number, rz: number, x: number, y: number, z: number, p: Paint): BufferGeometry {
  return paint(new SphereGeometry(1, 14, 10).scale(rx, ry, rz).translate(x, y, z), p)
}

const UP = new Vector3(0, 1, 0)
/** A tapered limb from `a` to `b`, radius r0 at a and r1 at b. */
function limb(a: V3, b: V3, r0: number, r1: number, p: Paint): BufferGeometry {
  const from = new Vector3(...a)
  const to = new Vector3(...b)
  const dir = to.clone().sub(from)
  const len = dir.length()
  const g = new CylinderGeometry(r1, r0, len, 7, 1)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir.normalize()))
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  return paint(g, p)
}

/** A cone pointing along `dir` from `base`. */
function spike(base: V3, dir: V3, r: number, len: number, p: Paint): BufferGeometry {
  const d = new Vector3(...dir).normalize()
  const g = new ConeGeometry(r, len, 6, 1)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d))
  g.translate(base[0] + d.x * (len / 2), base[1] + d.y * (len / 2), base[2] + d.z * (len / 2))
  return paint(g, p)
}

function deer(): BufferGeometry {
  const back = hex('#8c6038')
  const belly = hex('#d8c3a0')
  const coat = shaded(belly, back, 0.45, 0.78)
  const dark = hex('#2b2118')
  const hoof = hex('#1d1712')
  // the head and neck dip together when it grazes
  const headW = (_x: number, y: number) => (y - 0.72) / 0.2

  const parts: BufferGeometry[] = [
    blob(0.15, 0.18, 0.27, 0, 0.63, 0.0, { color: coat }), // barrel
    blob(0.145, 0.19, 0.17, 0, 0.64, 0.17, { color: coat }), // chest
    blob(0.14, 0.18, 0.17, 0, 0.64, -0.2, { color: coat }), // haunch
    blob(0.03, 0.06, 0.03, 0, 0.7, -0.4, { color: [0.95, 0.93, 0.9] }), // white tail
    limb([0, 0.74, 0.27], [0, 0.93, 0.42], 0.08, 0.05, { color: coat, head: headW }), // neck
    blob(0.055, 0.058, 0.1, 0, 0.95, 0.47, { color: mix(back, belly, 0.15), head: headW }), // head
    blob(0.036, 0.036, 0.07, 0, 0.925, 0.57, { color: mix(back, belly, 0.4), head: headW }), // muzzle
    blob(0.022, 0.02, 0.02, 0, 0.925, 0.635, { color: dark, head: headW }), // nose
    spike([0.04, 1.0, 0.43], [0.9, 1, -0.1], 0.026, 0.1, { color: coat, head: headW }), // ears
    spike([-0.04, 1.0, 0.43], [-0.9, 1, -0.1], 0.026, 0.1, { color: coat, head: headW }),
  ]
  // legs: front pair at the chest, rear pair at the haunch, with a bend (knee or hock)
  for (const sx of [-1, 1]) {
    for (const front of [true, false]) {
      const z = front ? 0.2 : -0.24
      const x = sx * 0.085
      const knee: V3 = front ? [x, 0.3, z + 0.01] : [x, 0.33, z - 0.07]
      const foot: V3 = front ? [x, 0.02, z + 0.01] : [x, 0.02, z - 0.02]
      const phase = sx * (front ? 1 : -1) > 0 ? 0 : Math.PI
      const leg = [0.6, 0.0] as [number, number]
      parts.push(
        limb([x, 0.6, z], knee, 0.055, 0.032, { color: coat, leg, phase }),
        limb(knee, foot, 0.03, 0.022, { color: mix(back, dark, 0.35), leg, phase }),
        blob(0.026, 0.02, 0.034, foot[0], 0.015, foot[2] + 0.005, { color: hoof, leg, phase }),
      )
    }
  }
  // antlers: a beam sweeping back and up from each side, with two tines (only on stags, see aFlag)
  const antler = hex('#cdbb98')
  for (const sx of [-1, 1]) {
    const base: V3 = [sx * 0.04, 1.0, 0.45]
    const mid: V3 = [sx * 0.11, 1.16, 0.4]
    const tip: V3 = [sx * 0.15, 1.34, 0.3]
    const paintA: Paint = { color: antler, head: headW, flag: 1 }
    parts.push(
      limb(base, mid, 0.014, 0.01, paintA),
      limb(mid, tip, 0.01, 0.005, paintA),
      limb(mid, [sx * 0.12, 1.3, 0.5], 0.008, 0.004, paintA),
      limb([sx * 0.13, 1.25, 0.37], [sx * 0.2, 1.33, 0.4], 0.007, 0.004, paintA),
    )
  }
  // a real deer's legs are about as long as its body is deep: squash the tall first draft
  return mergeGeometries(parts).scale(1, 0.82, 1)
}

function fox(): BufferGeometry {
  const red = hex('#c4541c')
  const cream = hex('#efe3cf')
  const coat = shaded(cream, red, 0.2, 0.38)
  const black = hex('#1c1512')
  const headW = (_x: number, y: number) => (y - 0.3) / 0.15
  const parts: BufferGeometry[] = [
    blob(0.085, 0.1, 0.2, 0, 0.31, -0.02, { color: coat }), // body
    blob(0.075, 0.09, 0.1, 0, 0.32, 0.12, { color: coat }), // chest
    blob(0.065, 0.065, 0.09, 0, 0.35, 0.22, { color: coat, head: headW }), // neck
    blob(0.058, 0.055, 0.075, 0, 0.375, 0.3, { color: red, head: headW }), // skull
    blob(0.035, 0.03, 0.075, 0, 0.35, 0.385, { color: mix(red, cream, 0.5), head: headW }), // snout
    blob(0.016, 0.014, 0.014, 0, 0.352, 0.455, { color: black, head: headW }), // nose
    // tall pointed ears, black at the tips
    spike([0.035, 0.41, 0.28], [0.25, 1, -0.2], 0.026, 0.1, {
      color: (_x, y) => mix(red, black, clamp01((y - 0.44) / 0.06)),
      head: headW,
    }),
    spike([-0.035, 0.41, 0.28], [-0.25, 1, -0.2], 0.026, 0.1, {
      color: (_x, y) => mix(red, black, clamp01((y - 0.44) / 0.06)),
      head: headW,
    }),
    // the brush: thick, drooping, with a white tip
    blob(0.055, 0.055, 0.15, 0, 0.28, -0.3, { color: mix(red, cream, 0.1) }),
    blob(0.05, 0.05, 0.09, 0, 0.25, -0.45, { color: cream }),
  ]
  for (const sx of [-1, 1]) {
    for (const front of [true, false]) {
      const z = front ? 0.12 : -0.15
      const x = sx * 0.048
      const phase = sx * (front ? 1 : -1) > 0 ? 0 : Math.PI
      const leg = [0.26, 0.0] as [number, number]
      // red above, black "stockings" below
      parts.push(
        limb([x, 0.26, z], [x, 0.02, z + (front ? 0.005 : -0.01)], 0.035, 0.018, {
          color: (_x, y) => mix(black, red, clamp01((y - 0.07) / 0.1)),
          leg,
          phase,
        }),
      )
    }
  }
  return mergeGeometries(parts)
}

/**
 * A gull: slim body, head and yellow beak, a fanned tail, and two long swept
 * wings with dark tips. Scaling nothing: the flapping is done in the shader, by
 * lifting each wing vertex in proportion to its distance from the body.
 */
function bird(): BufferGeometry {
  const white = hex('#f4f2ec')
  const grey = hex('#b9bdc2')
  const ink = hex('#25272b')
  const beak = hex('#e8b324')
  const parts: BufferGeometry[] = [
    blob(0.045, 0.042, 0.15, 0, 0, 0, { color: shaded(white, [0.93, 0.93, 0.92], -0.04, 0.04) }),
    blob(0.034, 0.033, 0.04, 0, 0.012, 0.16, { color: white }),
    spike([0, 0.005, 0.185], [0, -0.05, 1], 0.014, 0.065, { color: beak }),
  ]

  // tail: a short fan
  const tail = new BufferGeometry()
  tail.setAttribute(
    'position',
    new Float32BufferAttribute([0, 0, -0.12, -0.07, 0, -0.27, 0, 0, -0.25, 0.07, 0, -0.27], 3),
  )
  tail.setIndex([0, 1, 2, 0, 2, 3])
  tail.computeVertexNormals()
  parts.push(paint(tail, { color: (_x, _y, z) => mix(white, grey, clamp01((-z - 0.2) / 0.07)) }))

  // wings: shoulder → swept-back tip → trailing edge back to the body
  for (const sx of [-1, 1]) {
    const w = new BufferGeometry()
    const P: V3[] = [
      [0.03, 0.02, 0.09], // 0 leading edge at the body
      [0.25, 0.05, 0.07], // 1 leading edge, mid
      [0.5, 0.07, -0.1], // 2 wingtip
      [0.45, 0.06, -0.13], // 3 trailing edge at the tip
      [0.22, 0.03, -0.07], // 4 trailing edge, mid
      [0.03, 0.01, -0.1], // 5 trailing edge at the body
    ]
    const flat = P.flatMap(([x, y, z]) => [sx * x, y, z])
    w.setAttribute('position', new Float32BufferAttribute(flat, 3))
    w.setIndex(sx > 0 ? [0, 1, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4] : [0, 4, 1, 0, 5, 4, 1, 3, 2, 1, 4, 3])
    w.computeVertexNormals()
    parts.push(
      paint(w, {
        // pale grey above, black wingtips
        color: (x) => mix(grey, ink, clamp01((Math.abs(x) - 0.36) / 0.08)),
        wing: true,
      }),
    )
  }
  return mergeGeometries(parts)
}

export const BODIES: Record<Species, BufferGeometry> = { bird: bird(), deer: deer(), fox: fox() }

/** A flat wedge on the ground, radius 1, centred on +z: a fox's cone of vision. */
export function visionCone(fov: number): BufferGeometry {
  return new CircleGeometry(1, 24, -Math.PI / 2 - fov / 2, fov).rotateX(-Math.PI / 2)
}

/** Colour shown for a species in legends. The bodies are painted on their vertices, so in the scene this only tints. */
export const BODY_COLOR: Record<Species, string> = {
  bird: '#f1efe8', // pale, like gulls: dark birds vanish against the forest
  deer: '#8a5a32',
  fox: '#c4541c',
}

/** Debug tint by state (Show states). */
export const STATE_COLOR: Record<AgentState, string> = {
  flock: '#60a5fa',
  graze: '#4ade80',
  wander: '#4ade80',
  flee: '#facc15',
  hunt: '#f43f5e',
  eat: '#a855f7',
  rest: '#94a3b8',
  displaced: '#fb923c',
  leaving: '#6b7280',
  drink: '#38bdf8',
  alert: '#fde047',
  stalk: '#fb7185',
  perch: '#c4b5fd',
}
