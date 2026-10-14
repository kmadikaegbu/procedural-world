import { Vector3 } from 'three'
import { makeRng } from './noise'

/**
 * Bracketed, stochastic L-system → branch segments + leaves.
 *
 *   rules string ──expand()──▶ symbol string ──turtle()──▶ { segments, leaves }
 *
 * Pure data in, pure data out (no meshes), so it's testable on its own and
 * `treeGeometry.ts` can turn the result into one merged BufferGeometry.
 *
 * Symbols
 *   F        draw a branch segment forward
 *   + -      turn left / right   (yaw   about the turtle's Up axis)
 *   & ^      pitch down / up     (pitch about the turtle's Left axis)
 *   \ /      roll left / right   (roll  about the turtle's Heading axis)
 *   [ ]      save / restore position + heading (opens / closes a child branch)
 *   A, B..   placeholders: rewritten by the rules, never drawn
 *
 * Same species + same seed → identical tree. Which rule fires comes from one
 * seeded stream; everything the turtle randomises (turn jitter, leaf spin and
 * size) is a hash of the symbol's own id instead. Each symbol's id comes from
 * its parent's, so it never depends on how many other symbols exist — which is
 * what lets the LODs be the SAME tree grown less far: drop the symbols born in
 * the last generation and every remaining branch lands exactly where it was.
 */

// ---------------------------------------------------------------------------
// Species — the "recipe". One recipe + many seeds = many unique trees.
// ---------------------------------------------------------------------------

export interface Species {
  name: string
  axiom: string
  /**
   * One rule per line:  `Symbol -> [probability:] replacement`
   * Several lines for the same symbol are alternatives; their probabilities
   * are normalised, so they don't need to sum to 1. Omit the probability for
   * an equal share. `#` starts a comment. Symbols with no rule are copied.
   */
  rules: string
  iterations: number
  /** Degrees for + - & ^ */
  angle: number
  /** Degrees for \ / (137.5 = golden angle, spreads branches around the trunk) */
  roll: number
  /** 0..1 — random ± fraction applied to every turn, so no two branches match */
  jitter: number
  /** Length of a trunk segment (arbitrary units — the tree is rescaled after) */
  length: number
  /** Each child branch's segments are this much shorter than its parent's */
  lengthFactor: number
  /** Trunk radius at the base, in the same units as `length` */
  radius: number
  /** Each child branch starts this much thinner than where it left its parent */
  radiusFactor: number
  /** Radius multiplier along each F — the taper from trunk to twig */
  taper: number
  /** Bends every segment down (+) or toward the light (−). ~0.05 is noticeable. */
  gravity: number
  /** Bends every segment sideways (toward +X), so the whole tree leans. */
  lean: number
  /** Branches per node the hand-written `rules` produce — the UI's slider default. */
  branches: number
  leaf: {
    size: number // leaf card length, same units as `length`
    perTip: number // cards clustered at each branch tip
    midChance: number // 0..1 chance of a card at the middle of a segment…
    minDepth: number // …once the branch is at least this many `[` deep
    colors: [string, string] // each card is a random blend of the two
  }
  bark: [string, string] // trunk colour → twig colour
  /** Finished tree is rescaled to this height (world units, before the per-tree scale) */
  height: number
}

// Rules are written with String.raw so the `\` roll symbol stays a single
// readable backslash instead of needing `\\`.

/** Open: airy, spreading crown — few thick limbs, a lot of sky showing through. */
const OPEN: Species = {
  name: 'open',
  axiom: 'FFA',
  rules: String.raw`
    A -> 0.55: F[/&A][\&A]            # plain fork
    A -> 0.25: F[/&A][\&A][+&FA]      # fork plus a low side limb
    A -> 0.20: FF[/&A][\&A]           # long clear stretch, then fork
  `,
  iterations: 4,
  angle: 34,
  roll: 120,
  jitter: 0.35,
  length: 1,
  lengthFactor: 0.8,
  radius: 0.16,
  radiusFactor: 0.68,
  taper: 0.9,
  gravity: -0.05, // reaches a little for the light
  lean: 0,
  branches: 2,
  leaf: {
    size: 0.9,
    perTip: 2,
    midChance: 0.25,
    minDepth: 3,
    colors: ['#6f8f4f', '#9bb55e'],
  },
  bark: ['#5b4636', '#7d6650'],
  height: 2.3,
}

/** Dense: short, bushy, rounded crown packed with leaves. */
const DENSE: Species = {
  name: 'dense',
  axiom: 'FA',
  rules: String.raw`
    A -> 0.35: F[/&A][\&A][+&A][-&A]  # four-way burst
    A -> 0.65: F[/&A][\&A][&A]        # three-way burst
  `,
  iterations: 4,
  angle: 40,
  roll: 137.5,
  jitter: 0.3,
  length: 1,
  lengthFactor: 0.72,
  radius: 0.2,
  radiusFactor: 0.62,
  taper: 0.88,
  gravity: 0,
  lean: 0,
  branches: 3,
  leaf: {
    size: 0.8,
    perTip: 4,
    midChance: 0.7,
    minDepth: 1,
    colors: ['#3f6b3a', '#5e8f45'],
  },
  bark: ['#4d3b2e', '#6a5340'],
  height: 2.0,
}

/** Leaning: wind-bent trunk with its limbs combed to one side. */
const LEANING: Species = {
  name: 'leaning',
  axiom: '&FA',
  rules: String.raw`
    A -> 0.45: F[/&A]FA               # one limb, trunk carries on
    A -> 0.35: F[\&A]F[/&A]           # limb each side
    A -> 0.20: FFA                    # just grows
  `,
  iterations: 5,
  angle: 28,
  roll: 100,
  jitter: 0.4,
  length: 1,
  lengthFactor: 0.82,
  radius: 0.15,
  radiusFactor: 0.66,
  taper: 0.9,
  gravity: -0.014,
  lean: 0.14, // the wind-bend
  branches: 2,
  leaf: {
    size: 0.85,
    perTip: 3,
    midChance: 0.35,
    minDepth: 2,
    colors: ['#7d8f3f', '#b0a845'],
  },
  bark: ['#6a5a48', '#8b7a62'],
  height: 2.1,
}

export const SPECIES = { open: OPEN, dense: DENSE, leaning: LEANING } as const
export type SpeciesName = keyof typeof SPECIES
export const SPECIES_NAMES = Object.keys(SPECIES) as SpeciesName[]

// ---------------------------------------------------------------------------
// STEP 1 — rewrite the axiom, `iterations` times
// ---------------------------------------------------------------------------

type Alternatives = { weight: number; to: string }[]

export function parseRules(text: string): Map<string, Alternatives> {
  const table = new Map<string, Alternatives>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const m = /^(\S)\s*->\s*(?:(\d*\.?\d+)\s*:\s*)?(\S+)$/.exec(line)
    if (!m) throw new Error(`Bad L-system rule: "${raw.trim()}"`)
    const list = table.get(m[1]) ?? []
    list.push({ weight: m[2] ? parseFloat(m[2]) : 1, to: m[3] })
    table.set(m[1], list)
  }
  return table
}

/** Mix two 32-bit ints into a well-scrambled third. */
export function hash32(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x7f4a7c15, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
/** hash32 as a 0..1 float. */
export const hash01 = (a: number, b: number) => hash32(a, b) / 4294967296

/** One symbol of the expanded string, plus where it came from. */
export interface Sym {
  ch: string
  /** Stable identity: a hash of its parent's id and its slot in the replacement. */
  id: number
  /** Generation that produced it (0 = the axiom). */
  born: number
}

/** Safety valve: a rule set that fans out too fast stops growing here. */
const MAX_SYMBOLS = 8000

export function expand(
  axiom: string,
  rules: Map<string, Alternatives>,
  iterations: number,
  rng: () => number,
  seed: number,
): { symbols: Sym[]; generations: number } {
  let cur: Sym[] = [...axiom].map((ch, i) => ({
    ch,
    id: hash32(seed, i + 1),
    born: 0,
  }))
  let generations = 0
  for (let g = 1; g <= iterations; g++) {
    const next: Sym[] = []
    for (const sym of cur) {
      const alts = rules.get(sym.ch)
      if (!alts) {
        next.push(sym) // untouched: keeps its id and birth generation
        continue
      }
      // weighted pick — one rng() per rewritten symbol, in string order
      let total = 0
      for (const a of alts) total += a.weight
      let roll = rng() * total
      let pick = alts[alts.length - 1]
      for (const a of alts) {
        roll -= a.weight
        if (roll < 0) {
          pick = a
          break
        }
      }
      let slot = 0
      for (const ch of pick.to) {
        next.push({ ch, id: hash32(sym.id, ++slot), born: g })
      }
    }
    if (next.length > MAX_SYMBOLS) break
    cur = next
    generations = g
  }
  return { symbols: cur, generations }
}

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
