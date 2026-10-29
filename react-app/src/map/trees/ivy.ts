import { Color, Vector3, type BufferGeometry } from 'three'
import { height, makeRng, type TerrainParams } from '../noise'
import { WORLD } from '../world/shore'
import { MeshBuilder } from './geometry'
import type { Leaf, Segment } from './turtle'
import type { PlacedTree } from './scatter'

/**
 * IVY — climbing plants that grow by feel rather than by grammar.
 *
 * An L-system follows a fixed recipe; ivy instead "feels" its surroundings.
 * Each strand is a tip that takes small steps. Before every step it looks for
 * the nearest surface it could cling to — a tree trunk or the ground — and
 * blends a few pulls into one direction:
 *
 *   keep going       the way it was already heading
 *   wander           a little randomness, so no two strands match
 *   adhesion         toward the surface, so it hugs trunks and banks
 *   climb            upward while it's clinging to a trunk
 *   gravity          downward when there's nothing to hold on to (it droops)
 *
 * Now and then a strand forks (branching chance), and leaves are dropped along
 * it. The result is ordinary segments + leaves — the same data the trees use —
 * so geometry.ts's MeshBuilder can turn it into one mesh.
 */

export interface IvySettings {
  /** How many ivy plants. 0 = no ivy. */
  plants: number
  /** Steps each strand may grow before it stops. */
  length: number
  /** Chance per step that a strand forks into two. */
  branching: number
  /** How hard a strand with nothing to hold on to is pulled down. */
  gravity: number
  /** How strongly strands are pulled onto the nearest trunk or ground. */
  adhesion: number
  /** Chance per step of a leaf. */
  leafDensity: number
}

export const IVY_DEFAULTS: IvySettings = {
  plants: 0,
  length: 70,
  branching: 0.04,
  gravity: 0.5,
  adhesion: 0.7,
  leafDensity: 0.6,
}

export const IVY_SLIDERS: {
  key: keyof IvySettings
  label: string
  title: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'plants', label: 'Ivy plants', title: 'How many ivy plants to grow — half climb tree trunks, half creep over steep banks. 0 = none.', min: 0, max: 80, step: 1 },
  { key: 'length', label: 'Growth', title: 'How far each strand grows (steps) before it stops.', min: 10, max: 200, step: 5 },
  { key: 'branching', label: 'Branching', title: 'Chance per step that a strand splits in two.', min: 0, max: 0.15, step: 0.005 },
  { key: 'gravity', label: 'Ivy gravity', title: 'How strongly a strand that has lost its grip droops toward the ground.', min: 0, max: 1, step: 0.05 },
  { key: 'adhesion', label: 'Adhesion', title: 'How tightly strands hug the nearest trunk or ground. Low = loose, wandering strands.', min: 0, max: 1, step: 0.05 },
  { key: 'leafDensity', label: 'Ivy leaves', title: 'Chance of a leaf at each step along a strand.', min: 0, max: 1, step: 0.05 },
]

/** A trunk the ivy can climb, simplified to a straight cylinder. */
interface Trunk {
  base: Vector3
  axis: Vector3 // unit, base → top
  length: number
  radius: number
}

// sizes at the readable scale (world units); growIvy multiplies them by sizeRatio
const BASE_STEP = 0.12 // per growth step
const BASE_REACH = 0.6 // a surface closer than this counts as "touching"
const SEGMENT_EVERY = 2 // one drawn stem segment per this many steps
const MAX_STEPS = 14000 // safety cap across all strands
const MAX_STRANDS_PER_PLANT = 14
const CELL = 4 // trunk lookup grid, world units

export interface IvyGrowth {
  segments: Segment[]
  leaves: Leaf[]
  /** For each leaf, the direction away from the surface it grew on. */
  leafNormals: Vector3[]
}

/**
 * Grow every ivy plant. Deterministic: same terrain, trees, settings and seed →
 * the same ivy. `trees` are the trees currently drawn.
 */
export function growIvy(
  params: TerrainParams,
  s: IvySettings,
  trees: PlacedTree[],
  seed: number,
  /** 1 at the readable scale; smaller at true scale, so ivy shrinks with the trees it climbs. */
  sizeRatio = 1,
): IvyGrowth {
  const k = sizeRatio
  const STEP = BASE_STEP * k
  const REACH = BASE_REACH * k
  const rng = makeRng(seed * 7919 + 4242)
  const out: IvyGrowth = { segments: [], leaves: [], leafNormals: [] }
  if (s.plants <= 0) return out

  // --- trunks: approximate each tree's trunk as a cylinder, the lower half of
  // the tree, leaning the way the tree leans
  const trunks: Trunk[] = trees.map((t) => {
    const axis = new Vector3(0, 1, 0)
      .applyAxisAngle(new Vector3(1, 0, 0), t.tiltX)
      .applyAxisAngle(new Vector3(0, 0, 1), t.tiltZ)
      .normalize()
    return {
      base: new Vector3(...t.pos),
      axis,
      length: 1.1 * t.scale,
      radius: 0.07 * t.scale * t.girth,
    }
  })
  const grid = new Map<string, Trunk[]>()
  for (const tr of trunks) {
    const k = `${Math.floor(tr.base.x / CELL)},${Math.floor(tr.base.z / CELL)}`
    const list = grid.get(k)
    if (list) list.push(tr)
    else grid.set(k, [tr])
  }

  const ground = (x: number, z: number) => height(x, z, params)
  const groundNormal = (x: number, z: number) => {
    const e = 0.3
    const h = ground(x, z)
    return new Vector3(h - ground(x + e, z), e, h - ground(x, z + e)).normalize()
  }

  /** Nearest surface to `p`: where it is, how far, which way is "out", and whether it's a trunk. */
  const nearest = (p: Vector3) => {
    const gy = ground(p.x, p.z)
    let best = {
      point: new Vector3(p.x, gy, p.z),
      dist: p.y - gy,
      normal: groundNormal(p.x, p.z),
      trunk: false,
    }
    const cx = Math.floor(p.x / CELL)
    const cz = Math.floor(p.z / CELL)
    for (let a = cx - 1; a <= cx + 1; a++) {
      for (let b = cz - 1; b <= cz + 1; b++) {
        for (const tr of grid.get(`${a},${b}`) ?? []) {
          // closest point on the trunk's centre line, then out to its bark
          const along = Math.min(tr.length, Math.max(0, p.clone().sub(tr.base).dot(tr.axis)))
          const centre = tr.base.clone().addScaledVector(tr.axis, along)
          const off = p.clone().sub(centre)
          const r = off.length()
          const d = r - tr.radius
          if (d < best.dist && r > 1e-6) {
            const normal = off.divideScalar(r)
            best = {
              point: centre.addScaledVector(normal, tr.radius),
              dist: d,
              normal,
              trunk: true,
            }
          }
        }
      }
    }
    return best
  }

  // --- roots: half at the foot of a tree, half on steep ground
  type Tip = { p: Vector3; dir: Vector3; steps: number; radius: number }
  const roots: Tip[] = []
  // (`k` below is the size ratio from the top of this function — the loop counter must not shadow it)
  for (let plant = 0; plant < s.plants; plant++) {
    if (plant % 2 === 0 && trees.length) {
      const tr = trunks[Math.floor(rng() * trunks.length)]
      const a = rng() * Math.PI * 2
      const p = tr.base
        .clone()
        .add(new Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(tr.radius + 0.02 * k))
      p.y += 0.02 * k
      roots.push({ p, dir: new Vector3(Math.cos(a) * 0.2, 1, Math.sin(a) * 0.2).normalize(), steps: s.length, radius: 0.02 * k })
    } else {
      // look for a bank: somewhere above the water that slopes more than ~25°
      for (let tries = 0; tries < 60; tries++) {
        // anywhere on the map: the height checks below decide which spots are banks
        const x = WORLD.x0 + rng() * (WORLD.x1 - WORLD.x0)
        const z = WORLD.z0 + rng() * (WORLD.z1 - WORLD.z0)
        if (ground(x, z) < params.seaLevel + 0.05) continue
        const n = groundNormal(x, z)
        if (n.y > 0.9) continue
        const p = new Vector3(x, ground(x, z) + 0.02 * k, z)
        const dir = new Vector3(rng() - 0.5, 0, rng() - 0.5).normalize()
        roots.push({ p, dir, steps: s.length, radius: 0.02 * k })
        break
      }
    }
  }

  // --- grow
  let totalSteps = 0
  for (const root of roots) {
    const queue: Tip[] = [root]
    let strands = 0
    while (queue.length && strands < MAX_STRANDS_PER_PLANT) {
      const tip = queue.shift()!
      strands++
      const p = tip.p.clone()
      let dir = tip.dir.clone()
      let segStart = p.clone()
      let r0 = tip.radius
      for (let i = 0; i < tip.steps && totalSteps < MAX_STEPS; i++, totalSteps++) {
        const surf = nearest(p)
        const touching = surf.dist < REACH
        const toward = surf.point.clone().sub(p)

        // blend the pulls into one heading
        const pull = dir.clone() // keep going
        pull.add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.7)) // wander
        if (touching) {
          if (toward.lengthSq() > 1e-8) pull.addScaledVector(toward.normalize(), s.adhesion * 1.6)
          if (surf.trunk) pull.y += 0.9 // climb
          // slide along the surface rather than into it
          pull.addScaledVector(surf.normal, -Math.min(0, pull.dot(surf.normal)))
        } else {
          pull.y -= s.gravity * 1.8 // nothing to hold: droop
          if (surf.dist < REACH * 3 && toward.lengthSq() > 1e-8) {
            pull.addScaledVector(toward.normalize(), s.adhesion * 0.6)
          }
        }
        dir = pull.normalize()
        p.addScaledVector(dir, STEP)

        // never sink into the ground or a trunk
        const after = nearest(p)
        if (after.dist < 0.015 * k) p.copy(after.point).addScaledVector(after.normal, 0.015 * k)
        // lost: wandered far from anything — stop this strand
        if (after.dist > 3 * k) break

        // a drawn stem segment every few steps, thinning toward the tip
        if ((i + 1) % SEGMENT_EVERY === 0) {
          const r1 = Math.max(0.006 * k, r0 * 0.985)
          out.segments.push({
            start: [segStart.x, segStart.y, segStart.z],
            end: [p.x, p.y, p.z],
            r0,
            r1,
            depth: 2, // thin → the cheap 3-sided tube
          })
          segStart = p.clone()
          r0 = r1
        }

        // a leaf, lying on the surface and facing out of it
        if (rng() < s.leafDensity) {
          const n = after.normal
          // a random direction lying flat on the surface
          const tangent = new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5)
            .cross(n)
            .normalize()
          const leafDir = tangent.clone().addScaledVector(n, 0.35).normalize()
          const side = n.clone().cross(leafDir).normalize()
          out.leaves.push({
            pos: [p.x + n.x * 0.01 * k, p.y + n.y * 0.01 * k, p.z + n.z * 0.01 * k],
            dir: [leafDir.x, leafDir.y, leafDir.z],
            side: [side.x, side.y, side.z],
            size: (0.2 + rng() * 0.12) * k,
            mix: rng(),
            rank: rng(),
          })
          out.leafNormals.push(n.clone())
        }

        // fork: a new strand sets off from here at an angle
        if (rng() < s.branching && i < tip.steps - 5) {
          const turn = (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.5)
          queue.push({
            p: p.clone(),
            dir: dir.clone().applyAxisAngle(after.normal, turn),
            steps: Math.floor((tip.steps - i) * 0.75),
            radius: r0 * 0.8,
          })
        }
      }
    }
  }
  return out
}

const IVY_STEM = new Color('#4a3b2c')
const IVY_LEAF_A = new Color('#3a6b2f')
const IVY_LEAF_B = new Color('#5f9440')

/** One mesh for all the ivy: stems as thin tubes, leaves as small cards. */
export function buildIvyGeometry(g: IvyGrowth): BufferGeometry {
  const b = new MeshBuilder()
  for (const seg of g.segments) b.tube(seg, 3, IVY_STEM)
  g.leaves.forEach((l, i) => {
    // kite() shades a card as if it were part of a ball around `centre`;
    // putting the centre just behind the leaf makes it face out of its surface
    const centre = new Vector3(...l.pos).addScaledVector(g.leafNormals[i], -1)
    b.kite(l, l.size, centre, new Color().lerpColors(IVY_LEAF_A, IVY_LEAF_B, l.mix))
  })
  return b.toGeometry()
}
