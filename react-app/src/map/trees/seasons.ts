/**
 * SEASONS — how the forest changes through the year.
 *
 * Nothing here regrows a tree. Each season is just a few numbers the tree
 * material reads (materials.ts):
 *   tint   the colour leaves shift toward
 *   mix    how far they shift (0 = keep the species' own green)
 *   keep   fraction of leaves still on the tree (the rest are hidden)
 *   bare   colour far-away "blob" trees fade to as leaves drop
 * plus how many fallen leaves to scatter round each trunk (FallenLeaves.tsx).
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonLook {
  tint: string
  mix: number
  keep: number
  bare: string
  /** Fallen leaves on the ground per tree. */
  fallenPerTree: number
  fallenColors: string[]
}

export const SEASONS: Record<Season, SeasonLook> = {
  // fresh, light new growth; a few buds still to open
  spring: {
    tint: '#9bd35a',
    mix: 0.55,
    keep: 0.85,
    bare: '#5c5248',
    fallenPerTree: 0,
    fallenColors: ['#7a9a48'],
  },
  // the species' own colours, full canopy
  summer: {
    tint: '#6f8f4f',
    mix: 0,
    keep: 1,
    bare: '#5c5248',
    fallenPerTree: 1,
    fallenColors: ['#7d8a46', '#8f7d44'],
  },
  // orange/red, thinning, a carpet underneath
  autumn: {
    tint: '#d9772b',
    mix: 0.85,
    keep: 0.6,
    bare: '#6b5544',
    fallenPerTree: 12,
    fallenColors: ['#c8642a', '#d9a03a', '#a8452a', '#b8862f'],
  },
  // almost bare; the last dry leaves are brown
  winter: {
    tint: '#8a7356',
    mix: 0.7,
    keep: 0.08,
    bare: '#5a5048',
    fallenPerTree: 5,
    fallenColors: ['#7a6248', '#5e4a38', '#8a7458'],
  },
}

export const SEASON_NAMES = Object.keys(SEASONS) as Season[]
