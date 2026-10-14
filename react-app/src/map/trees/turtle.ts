import { Vector3 } from 'three'
import { makeRng } from '../noise'
import { expand, hash01, hash32, parseRules, type Sym } from './grammar'
import type { Species } from './species'

/**
 * TURTLE — the drawing half of the L-system.
 *
 * Imagine a turtle holding a pen, standing at the base of the trunk and facing
 * up. It reads the expanded string one letter at a time:
 *
 *   F        walk forward one segment, drawing a branch as it goes
 *   + -      turn left / right   (yaw   — about the turtle's Up axis)
 *   & ^      pitch down / up     (pitch — about the turtle's Left axis)
 *   \ /      roll left / right   (roll  — about the turtle's Heading axis)
 *   [        remember where I am and which way I face (start a side branch)
 *   ]        jump back to the last remembered spot   (end that side branch)
 *   A, B…    placeholders — only there to be rewritten; the turtle skips them
 *
 * Because "[" saves and "]" restores, `F[+F]F` draws a trunk with one side
 * twig: walk, remember, turn and draw the twig, jump back, carry on up.
 *
 * Output is pure data — a list of segments (start, end, radius, depth) and
 * leaves — which geometry.ts turns into meshes.
 *
 * Same species + same seed → identical tree, because every random choice is a
 * hash of a symbol's own id (see grammar.ts), never a shared random stream.
 */

// ---------------------------------------------------------------------------
// STEP 2 — walk the string with a turtle
// ---------------------------------------------------------------------------

export interface Segment {
  start: [number, number, number]
  end: [number, number, number]
  r0: number // radius at start
  r1: number // radius at end
  depth: number // how many `[` deep (0 = trunk)
}

export interface Leaf {
  pos: [number, number, number]
  dir: [number, number, number] // unit — the way the card points
  side: [number, number, number] // unit, ⟂ dir — the card's width axis
  size: number
  mix: number // 0..1 blend between the species' two leaf colours
  rank: number // 0..1 drop order in autumn — low ranks hold on longest
}

export interface TreeSkeleton {
  segments: Segment[]
  leaves: Leaf[]
  /** Generations actually run — less than asked for if MAX_SYMBOLS cut it short. */
  generations: number
}

interface Turtle {
  pos: Vector3
  H: Vector3 // heading
  L: Vector3 // left
  U: Vector3 // up
  radius: number
  length: number
  depth: number
  drew: boolean // has this branch drawn anything yet (→ does it get a tip leaf)
}

const clone = (t: Turtle): Turtle => ({
  pos: t.pos.clone(),
  H: t.H.clone(),
  L: t.L.clone(),
  U: t.U.clone(),
  radius: t.radius,
  length: t.length,
  depth: t.depth,
  drew: t.drew,
})

const DEG = Math.PI / 180
const arr = (v: Vector3): [number, number, number] => [v.x, v.y, v.z]

/** Turtle output before it is scaled to the species' height (see `scaled`). */
export function interpret(
  symbols: Sym[],
  generations: number,
  sp: Species,
  seed: number,
): TreeSkeleton {
  const segments: Segment[] = []
  const leaves: Leaf[] = []

  // Starts pointing straight up (H = +Y). H × L = U keeps the frame right-handed.
  let t: Turtle = {
    pos: new Vector3(0, 0, 0),
    H: new Vector3(0, 1, 0),
    L: new Vector3(-1, 0, 0),
    U: new Vector3(0, 0, 1),
    radius: sp.radius,
    length: sp.length,
    depth: 0,
    drew: false,
  }
  const stack: Turtle[] = []
  // one bend vector: gravity pulls −Y, lean pushes +X (with a little sideways drift)
  const tropism = new Vector3(sp.lean, -sp.gravity, sp.lean * 0.2)
  const tropismStrength = tropism.length()
  if (tropismStrength > 1e-6) tropism.divideScalar(tropismStrength)
  const axis = new Vector3()

  // every random number below is hash01(some symbol's id, a salt) — never a
  // shared stream — so a symbol behaves the same whatever else is in the string
  const jittered = (deg: number, id: number) =>
    deg * DEG * (1 + (hash01(id, 1) * 2 - 1) * sp.jitter)

  // rotate two of the three frame vectors about the third
  const turn = (about: Vector3, a: Vector3, b: Vector3, rad: number) => {
    a.applyAxisAngle(about, rad)
    b.applyAxisAngle(about, rad)
  }

  const addLeaf = (at: Vector3, tip: boolean, id: number, k: number) => {
    const r = (n: number) => hash01(id, 100 + k * 8 + n)
    // spin the card's width axis randomly around the heading, so cards fan out
    const spin = r(0) * Math.PI * 2
    const s = t.L.clone().applyAxisAngle(t.H, spin)
    // tip cards continue the branch; mid-branch cards stick out sideways
    const dir = t.H.clone().addScaledVector(s, tip ? 0.6 : 1.3).normalize()
    const side = t.L.clone().applyAxisAngle(t.H, spin + Math.PI / 2)
    side.addScaledVector(dir, -side.dot(dir)).normalize()
    leaves.push({
      pos: arr(at),
      dir: arr(dir),
      side: arr(side),
      size: sp.leaf.size * (0.75 + r(1) * 0.5),
      mix: r(2),
      rank: r(3),
    })
  }

  const tipLeaves = (id: number) => {
    if (!t.drew) return
    for (let i = 0; i < sp.leaf.perTip; i++) addLeaf(t.pos, true, id, i)
  }

  for (const { ch, id } of symbols) {
    switch (ch) {
      case 'F': {
        if (tropismStrength > 1e-6) {
          // bend H toward the tropism vector; the nearer they are, the less it bends
          axis.crossVectors(t.H, tropism)
          const strength = tropismStrength * axis.length()
          if (strength > 1e-6) {
            axis.normalize()
            t.H.applyAxisAngle(axis, strength)
            t.L.applyAxisAngle(axis, strength)
            t.U.applyAxisAngle(axis, strength)
          }
        }
        const start = t.pos.clone()
        t.pos.addScaledVector(t.H, t.length)
        const r0 = t.radius
        t.radius *= sp.taper
        segments.push({
          start: arr(start),
          end: arr(t.pos),
          r0,
          r1: t.radius,
          depth: t.depth,
        })
        t.drew = true
        if (t.depth >= sp.leaf.minDepth && hash01(id, 50) < sp.leaf.midChance) {
          addLeaf(start.lerp(t.pos, 0.5), false, id, 0)
        }
        break
      }
      case '+': turn(t.U, t.H, t.L, jittered(sp.angle, id)); break
      case '-': turn(t.U, t.H, t.L, -jittered(sp.angle, id)); break
      case '&': turn(t.L, t.H, t.U, jittered(sp.angle, id)); break
      case '^': turn(t.L, t.H, t.U, -jittered(sp.angle, id)); break
      case '\\': turn(t.H, t.L, t.U, jittered(sp.roll, id)); break
      case '/': turn(t.H, t.L, t.U, -jittered(sp.roll, id)); break
      case '[': {
        stack.push(clone(t))
        t.depth++
        t.length *= sp.lengthFactor
        t.radius *= sp.radiusFactor
        t.drew = false
        break
      }
      case ']': {
        tipLeaves(id)
        t = stack.pop() ?? t
        break
      }
      // A, B, digits… — placeholders, ignored
    }
  }
  tipLeaves(hash32(seed, 0xbeef)) // the trunk's own tip

  return { segments, leaves, generations }
}

/** Scale that lands a skeleton at `height` — measured on the FULL tree and reused by every LOD. */
function heightScale(sk: TreeSkeleton, height: number): number {
  let top = 0
  for (const s of sk.segments) top = Math.max(top, s.start[1], s.end[1])
  return top > 0 ? height / top : 1
}

function scaled(sk: TreeSkeleton, k: number): TreeSkeleton {
  const sc = (p: [number, number, number]): [number, number, number] => [
    p[0] * k,
    p[1] * k,
    p[2] * k,
  ]
  return {
    generations: sk.generations,
    segments: sk.segments.map((s) => ({
      ...s,
      start: sc(s.start),
      end: sc(s.end),
      r0: s.r0 * k,
      r1: s.r1 * k,
    })),
    leaves: sk.leaves.map((l) => ({ ...l, pos: sc(l.pos), size: l.size * k })),
  }
}

// ---------------------------------------------------------------------------
// The calls everything else uses
// ---------------------------------------------------------------------------

/**
 * One tree at three growth stages, all from one expansion and one scale:
 *   full    — every generation
 *   reduced — one generation fewer (the LOD1 tree)
 *   trunk   — trunk + main limbs only (depth ≤ 1), with the FULL leaf set so the
 *             LOD2 builder can merge them into clusters
 */
export interface TreeStages {
  full: TreeSkeleton
  reduced: TreeSkeleton
  trunk: TreeSkeleton
}

/** Deterministic: the same (species, seed) always returns the same trees. */
export function generateTreeStages(sp: Species, seed: number): TreeStages {
  const rng = makeRng(seed)
  const { symbols, generations } = expand(
    sp.axiom,
    parseRules(sp.rules),
    sp.iterations,
    rng,
    seed,
  )
  const full = interpret(symbols, generations, sp, seed)
  const k = heightScale(full, sp.height)

  // dropping the symbols born in the last generation == having stopped one early
  const last = Math.max(generations - 1, 0)
  const reduced = interpret(
    symbols.filter((s) => s.born <= last),
    last,
    sp,
    seed,
  )
  const trunk: TreeSkeleton = {
    segments: full.segments.filter((s) => s.depth <= 1),
    leaves: full.leaves,
    generations: Math.min(generations, 1),
  }
  return {
    full: scaled(full, k),
    reduced: scaled(reduced, k),
    trunk: scaled(trunk, k),
  }
}

/** The full-detail tree. */
export const generateTree = (sp: Species, seed: number): TreeSkeleton =>
  generateTreeStages(sp, seed).full
