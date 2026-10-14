/**
 * SPECIES — the tree "recipes".
 *
 * An L-system grows a plant by repeatedly rewriting a string of letters:
 *
 *   axiom  "FFA"                          the seed you start from
 *   rule   A -> F[/&A][\&A]               "every A becomes this"
 *
 *   generation 0:  FFA
 *   generation 1:  FF F[/&A][\&A]
 *   generation 2:  FF F[/&F[/&A][\&A]][\&F[/&A][\&A]]   …and so on
 *
 * Each pass, every A sprouts a fork with two new A's at its tips, so the tree
 * branches more each generation. A "turtle" then walks the final string and
 * draws it (see turtle.ts for what each letter means).
 *
 * A recipe here is the axiom, the rules, and the numbers the turtle uses
 * (angles, lengths, thickness, leaves). One recipe + a different seed = a
 * different tree of the same kind — the seed decides which rule fires when a
 * symbol has several (the "stochastic" part) and how much each turn wobbles.
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
