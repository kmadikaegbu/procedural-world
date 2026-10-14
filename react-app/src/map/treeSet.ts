import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'
import { SPECIES, SPECIES_NAMES, type Species, type SpeciesName } from './lsystem'
import { LOD_COUNT, buildVariants, type TreeLods } from './treeGeometry'

/**
 * The tree settings the UI edits, and the set of tree shapes they grow.
 *
 *   TreeParams ──speciesFromParams()──▶ Species ──buildVariants()──▶ TreeSet
 *
 * App owns the TreeParams + calls useTreeSet; the geometries then ride down to
 * <Props> as a prop, so the stats readout and the forest read the same set.
 */

export interface TreeParams {
  /** One species for the whole forest, or 'mixed' = the three presets in stands. */
  species: SpeciesName | 'mixed'
  generations: number
  angle: number
  jitter: number
  length: number
  lengthFactor: number
  radius: number
  radiusFactor: number
  branches: number
  gravity: number
  lean: number
  leafSize: number
  /** Multiplier on the species' leaves per tip and mid-branch leaf chance. */
  leafDensity: number
  seed: number
}

export type TreeParamKey = Exclude<keyof TreeParams, 'species'>

/** Slider definitions — App maps over these, so adding a parameter is one line. */
export const TREE_SLIDERS: {
  key: TreeParamKey
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'generations', label: 'Generations', title: 'How many times the rules rewrite the tree. Each one adds a layer of finer branches — and multiplies the cost.', min: 1, max: 7, step: 1 },
  { key: 'angle', label: 'Angle', title: 'How far branches splay away from their parent, in degrees.', min: 5, max: 80, step: 1 },
  { key: 'jitter', label: 'Randomness', title: 'Random ± variation applied to every turn, so no two branches match. 0 = perfectly regular.', min: 0, max: 1, step: 0.05 },
  { key: 'length', label: 'Segment', title: 'Length of a trunk segment. The finished tree is rescaled to its species height, so this mostly changes proportions (trunk vs. twigs), not overall size.', min: 0.3, max: 2, step: 0.05 },
  { key: 'lengthFactor', label: 'Len falloff', title: 'Each child branch is this fraction as long as its parent. Low = stubby twigs, high = long limbs.', min: 0.4, max: 1, step: 0.01 },
  { key: 'radius', label: 'Trunk radius', title: 'Thickness of the trunk at the base (relative to its length).', min: 0.03, max: 0.4, step: 0.01 },
  { key: 'radiusFactor', label: 'Rad falloff', title: 'Each child branch starts this fraction as thick as where it left its parent.', min: 0.3, max: 1, step: 0.01 },
  { key: 'branches', label: 'Branches', title: 'Branches sprouting at each node, spread evenly around the trunk. Starts at the species default; any other value swaps in a generic rule set.', min: 1, max: 5, step: 1 },
  { key: 'gravity', label: 'Gravity', title: 'Positive droops branches toward the ground (weeping); negative reaches for the light.', min: -0.3, max: 0.3, step: 0.01 },
  { key: 'lean', label: 'Lean', title: 'Bends the whole tree sideways, like a wind-swept tree.', min: 0, max: 0.4, step: 0.01 },
  { key: 'leafSize', label: 'Leaf size', title: 'Size of each leaf card.', min: 0.1, max: 2, step: 0.05 },
  { key: 'leafDensity', label: 'Leaf density', title: 'Scales how many leaves sit at branch tips and along branches. 0 = bare, 2 = twice the preset.', min: 0, max: 2, step: 0.05 },
  { key: 'seed', label: 'Seed', title: 'Changes every tree in the forest. The same seed always grows the same trees.', min: 0, max: 999, step: 1 },
]

export function paramsFromSpecies(name: SpeciesName, seed = 0): TreeParams {
  const sp = SPECIES[name]
  return {
    species: name,
    generations: sp.iterations,
    angle: sp.angle,
    jitter: sp.jitter,
    length: sp.length,
    lengthFactor: sp.lengthFactor,
    radius: sp.radius,
    radiusFactor: sp.radiusFactor,
    branches: sp.branches,
    gravity: sp.gravity,
    lean: sp.lean,
    leafSize: sp.leaf.size,
    leafDensity: 1,
    seed,
  }
}

/** A generic stochastic rule set with `n` evenly spread branches per node. */
function branchRules(n: number): string {
  const ring = Array(n).fill('[&A]').join('/') //   n limbs, rolled round the trunk
  const open = n > 1 ? Array(n - 1).fill('[&A]').join('/') + '/A' : 'A' // …or one fewer, trunk carries on
  return `
    A -> 0.7: F${ring}
    A -> 0.3: F${open}
  `
}

export function speciesFromParams(p: TreeParams, name: SpeciesName): Species {
  const base = SPECIES[name]
  // at the preset's own branch count keep its hand-written rules; otherwise
  // swap in the generic ones, with the roll that spreads n limbs evenly
  const custom = p.branches !== base.branches
  return {
    ...base,
    iterations: p.generations,
    angle: p.angle,
    jitter: p.jitter,
    length: p.length,
    lengthFactor: p.lengthFactor,
    radius: p.radius,
    radiusFactor: p.radiusFactor,
    gravity: p.gravity,
    lean: p.lean,
    rules: custom ? branchRules(p.branches) : base.rules,
    roll: custom ? 360 / p.branches : base.roll,
    leaf: {
      ...base.leaf,
      size: p.leafSize,
      perTip: Math.round(base.leaf.perTip * p.leafDensity),
      midChance: Math.min(1, base.leaf.midChance * p.leafDensity),
    },
  }
}

// ---------------------------------------------------------------------------

export interface TreeStats {
  /** Unique shapes in the set. */
  variants: number
  /** Averages per tree (one instance of a shape). `triangles` is LOD0, the full tree. */
  triangles: number
  /** Average triangles at each LOD, nearest first. */
  lodTriangles: number[]
  branches: number
  leaves: number
  /** Time to grow + build every shape in the set, in ms. */
  genMs: number
  /** Fewest generations any variant actually ran (< requested ⇒ hit the size cap). */
  generations: number
}

/** One tree shape: its four levels of detail, nearest first. */
export interface TreeShape {
  lods: BufferGeometry[]
  tris: number[]
}

export interface TreeSet {
  shapes: TreeShape[]
  /** Mixed set = three species × variantsPerSpecies, species-major. Otherwise one species. */
  mixed: boolean
  variantsPerSpecies: number
  stats: TreeStats
}

// A single species has to supply the whole forest's variety, so it grows twice
// as many shapes as each species of the mixed forest does.
const SINGLE_FACTOR = 2

function summarise(built: TreeLods[], genMs: number): TreeStats {
  const n = built.length
  const lodTris = Array<number>(LOD_COUNT).fill(0)
  let branches = 0
  let leaves = 0
  let generations = Infinity
  for (const b of built) {
    b.tris.forEach((t, l) => (lodTris[l] += t))
    branches += b.branches
    leaves += b.leaves
    generations = Math.min(generations, b.generations)
  }
  return {
    variants: n,
    triangles: Math.round(lodTris[0] / n),
    lodTriangles: lodTris.map((t) => Math.round(t / n)),
    branches: Math.round(branches / n),
    leaves: Math.round(leaves / n),
    genMs,
    generations,
  }
}

// The preset mix only depends on how many variants, so grow each size once and share it.
const mixedSets = new Map<number, TreeSet>()
function getMixedSet(variants: number): TreeSet {
  let set = mixedSets.get(variants)
  if (!set) {
    const t0 = performance.now()
    const built = SPECIES_NAMES.flatMap((n) =>
      buildVariants(SPECIES[n], variants),
    )
    set = {
      shapes: built.map(({ lods, tris }) => ({ lods, tris })),
      mixed: true,
      variantsPerSpecies: variants,
      stats: summarise(built, performance.now() - t0),
    }
    mixedSets.set(variants, set)
  }
  return set
}

function growSingle(p: TreeParams, name: SpeciesName, variants: number): TreeSet {
  const t0 = performance.now()
  const count = variants * SINGLE_FACTOR
  const built = buildVariants(speciesFromParams(p, name), count, p.seed)
  return {
    shapes: built.map(({ lods, tris }) => ({ lods, tris })),
    mixed: false,
    variantsPerSpecies: count,
    stats: summarise(built, performance.now() - t0),
  }
}

/** Regrows the shapes whenever the settings change — i.e. live while a slider drags. */
export function useTreeSet(p: TreeParams, variants: number): TreeSet {
  const set = useMemo(
    () =>
      p.species === 'mixed'
        ? getMixedSet(variants)
        : growSingle(p, p.species, variants),
    [p, variants],
  )
  // free the GPU buffers of a set we've replaced (the shared mixed set lives on)
  useEffect(
    () => () => {
      if (!set.mixed) for (const sh of set.shapes) for (const g of sh.lods) g.dispose()
    },
    [set],
  )
  return set
}
