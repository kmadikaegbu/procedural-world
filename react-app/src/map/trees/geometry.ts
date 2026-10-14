import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import {
  generateTreeStages,
  type Leaf,
  type Segment,
  type TreeStages,
} from './turtle'
import type { Species } from './species'

/**
 * TreeStages → four BufferGeometries (LOD0 … LOD3), all from the same recipe.
 *
 *   LOD0  every generation, every leaf card, 7-sided limbs / 6-sided twigs
 *   LOD1  one generation fewer of branches; half the leaves, 1.45× bigger; 5 / 4 sides
 *   LOD2  trunk + main limbs only (4 sides); leaves merged into up to 8 clumps
 *   LOD3  a trunk stick + one blob in the tree's own average colour (26 triangles)
 *
 * Each is one merged, vertex-coloured mesh, so a whole forest is a handful of
 * instanced draw calls (see Props.tsx).
 */

export const LOD_COUNT = 4

/** Collects triangles (tubes, leaf cards, blobs) into one vertex-coloured mesh. */
export class MeshBuilder {
  pos: number[] = []
  nrm: number[] = []
  col: number[] = []
  /** Per vertex: 0 bark, 0..1 a leaf's drop rank, −1 a whole-tree blob (see materials.ts). */
  leaf: number[] = []
  idx: number[] = []

  private get verts() {
    return this.pos.length / 3
  }

  private vertex(
    p: ArrayLike<number>,
    n: ArrayLike<number>,
    c: { r: number; g: number; b: number },
    leaf = 0,
  ) {
    this.pos.push(p[0], p[1], p[2])
    this.nrm.push(n[0], n[1], n[2])
    this.col.push(c.r, c.g, c.b)
    this.leaf.push(leaf)
  }

  /** Open tube (no end caps — the next segment or a leaf hides the join). */
  tube(s: Segment, sides: number, color: Color) {
    const d = new Vector3(
      s.end[0] - s.start[0],
      s.end[1] - s.start[1],
      s.end[2] - s.start[2],
    ).normalize()
    // any vector not parallel to d gives a perpendicular frame
    const u = Math.abs(d.z) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1)
    u.crossVectors(d, u).normalize()
    const v = new Vector3().crossVectors(d, u)

    const base = this.verts
    for (let ring = 0; ring < 2; ring++) {
      const p = ring === 0 ? s.start : s.end
      const r = ring === 0 ? s.r0 : s.r1
      for (let k = 0; k <= sides; k++) {
        // seam vertex repeated → no wrap-around index maths
        const a = (k / sides) * Math.PI * 2
        const nx = u.x * Math.cos(a) + v.x * Math.sin(a)
        const ny = u.y * Math.cos(a) + v.y * Math.sin(a)
        const nz = u.z * Math.cos(a) + v.z * Math.sin(a)
        this.vertex([p[0] + nx * r, p[1] + ny * r, p[2] + nz * r], [nx, ny, nz], color)
      }
    }
    const row = sides + 1
    for (let k = 0; k < sides; k++) {
      const a = base + k
      const b = a + 1
      const c = a + row
      const e = c + 1
      // counter-clockwise seen from outside → the outer face is the front face
      this.idx.push(a, b, c, b, e, c)
    }
  }

  /**
   * A flat kite, 2 triangles. Its normal leans outward from the canopy centre
   * so a plain card still shades like part of a soft ball.
   */
  kite(l: Leaf, size: number, centre: Vector3, color: Color) {
    const p0 = new Vector3(...l.pos)
    const dir = new Vector3(...l.dir).multiplyScalar(size)
    const side = new Vector3(...l.side).multiplyScalar(size * 0.35)
    const q = [
      p0.clone(),
      p0.clone().addScaledVector(dir, 0.4).add(side),
      p0.clone().add(dir),
      p0.clone().addScaledVector(dir, 0.4).sub(side),
    ]
    const out = q[1].clone().sub(centre).normalize()
    const face = new Vector3(...l.dir).cross(new Vector3(...l.side))
    if (face.dot(out) < 0) face.negate()
    const n = face.multiplyScalar(0.35).addScaledVector(out, 0.65).normalize()

    // darker toward the canopy's inside, brighter outside → cheap AO
    const shade = 0.78 + 0.22 * Math.min(1, Math.max(0, out.y * 0.5 + 0.5))
    const c = color.clone().multiplyScalar(shade)

    const base = this.verts
    // the leaf's drop rank decides when it falls in autumn (never exactly 0 — that means bark)
    const rank = Math.max(l.rank, 0.001)
    for (const p of q) this.vertex([p.x, p.y, p.z], [n.x, n.y, n.z], c, rank)
    // wound so the outward-facing side is the "front": the material is
    // double-sided, but three flips normals on back faces
    const fn = new Vector3()
      .subVectors(q[1], q[0])
      .cross(new Vector3().subVectors(q[2], q[0]))
    if (fn.dot(n) >= 0) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
  }

  /**
   * Low-poly ellipsoid with smooth normals: an icosahedron (20 triangles), or with
   * `coarse` an octahedron (8) — bulked up so it still covers about the same space.
   */
  blob(
    centre: Vector3,
    rx: number,
    ry: number,
    rz: number,
    color: Color,
    coarse = false,
    leaf = -1,
  ) {
    const base = this.verts
    const verts = coarse ? OCT_VERTS : ICO_VERTS
    const faces = coarse ? OCT_FACES : ICO_FACES
    if (coarse) [rx, ry, rz] = [rx * 1.25, ry * 1.25, rz * 1.25]
    for (const [x, y, z] of verts) {
      const shade = 0.78 + 0.22 * (y * 0.5 + 0.5) // top lighter, underside darker
      this.vertex(
        [centre.x + x * rx, centre.y + y * ry, centre.z + z * rz],
        [x, y, z],
        { r: color.r * shade, g: color.g * shade, b: color.b * shade },
        leaf,
      )
    }
    for (const f of faces) this.idx.push(base + f[0], base + f[1], base + f[2])
  }

  triangles() {
    return this.idx.length / 3
  }

  /** Area-weighted mean vertex colour — what the tree looks like from far away. */
  averageColor(): Color {
    let r = 0
    let g = 0
    let b = 0
    let total = 0
    const P = (i: number) =>
      new Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2])
    for (let t = 0; t < this.idx.length; t += 3) {
      const [i, j, k] = [this.idx[t], this.idx[t + 1], this.idx[t + 2]]
      const area = new Vector3()
        .subVectors(P(j), P(i))
        .cross(new Vector3().subVectors(P(k), P(i)))
        .length()
      for (const v of [i, j, k]) {
        r += (this.col[v * 3] * area) / 3
        g += (this.col[v * 3 + 1] * area) / 3
        b += (this.col[v * 3 + 2] * area) / 3
      }
      total += area
    }
    return total > 0
      ? new Color(r / total, g / total, b / total)
      : new Color(0.3, 0.5, 0.3)
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3))
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nrm), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3))
    g.setAttribute('aLeaf', new BufferAttribute(new Float32Array(this.leaf), 1))
    g.setIndex(new BufferAttribute(new Uint32Array(this.idx), 1))
    g.computeBoundingSphere()
    return g
  }
}

const OCT_VERTS: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]
const OCT_FACES = [
  [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
  [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
]

const PHI = (1 + Math.sqrt(5)) / 2
const ICO_VERTS = (
  [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ] as [number, number, number][]
).map(([x, y, z]) => {
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l] as [number, number, number]
})
const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
]

// ---------------------------------------------------------------------------

/** Radial sides per LOD0–2: [trunk, everything thinner]. LOD0/1 count limbs (depth 1) as "trunk"; LOD2 doesn't. */
export const LOD_SIDES: [number, number][] = [
  [7, 6],
  [5, 4],
  [4, 3],
]

export interface TreeLods {
  /** LOD0 … LOD3, nearest first. */
  lods: BufferGeometry[]
  /** Triangles in each. */
  tris: number[]
  branches: number
  leaves: number
  generations: number
}

export function buildTreeLods(stages: TreeStages, sp: Species): TreeLods {
  const { full, reduced, trunk } = stages
  const barkA = new Color(sp.bark[0])
  const barkB = new Color(sp.bark[1])
  const leafA = new Color(sp.leaf.colors[0])
  const leafB = new Color(sp.leaf.colors[1])
  // bark colour runs trunk → twig over the FULL tree's depth, so every LOD agrees
  const maxDepth = Math.max(1, ...full.segments.map((s) => s.depth))
  const leafColor = (l: Leaf) => new Color().lerpColors(leafA, leafB, l.mix)

  // `thinFrom`: the depth from which branches count as thin and get the cheaper side count
  const tubes = (
    b: MeshBuilder,
    segs: Segment[],
    sides: [number, number],
    thinFrom = 2,
  ) => {
    for (const s of segs) {
      const bark = new Color().lerpColors(barkA, barkB, s.depth / maxDepth)
      b.tube(s, s.depth >= thinFrom ? sides[1] : sides[0], bark)
    }
  }
  const centreOf = (leaves: Leaf[]) => {
    const c = new Vector3()
    for (const l of leaves) c.add(new Vector3(...l.pos))
    return leaves.length ? c.divideScalar(leaves.length) : c
  }
  const cards = (
    b: MeshBuilder,
    leaves: Leaf[],
    keepEvery: number,
    grow: number,
  ) => {
    const centre = centreOf(leaves)
    leaves.forEach((l, i) => {
      // leaves sit in tip clusters, so taking every Nth one thins each cluster evenly
      if (i % keepEvery === 0) b.kite(l, l.size * grow, centre, leafColor(l))
    })
  }

  // LOD0 — everything
  const b0 = new MeshBuilder()
  tubes(b0, full.segments, LOD_SIDES[0])
  cards(b0, full.leaves, 1, 1)

  // Each leaf card covers more than its anchor point: these are the points it
  // reaches (base, tip, both shoulders) — used to size the stand-ins below so
  // they cover the same patch of sky as the real leaves.
  const cardPoints = (l: Leaf): Vector3[] => {
    const p = new Vector3(...l.pos)
    const d = new Vector3(...l.dir).multiplyScalar(l.size)
    const sd = new Vector3(...l.side).multiplyScalar(l.size * 0.35)
    const mid = p.clone().addScaledVector(d, 0.4)
    return [p, p.clone().add(d), mid.clone().add(sd), mid.clone().sub(sd)]
  }

  // LOD1 — a generation fewer of BRANCHES, but leaves still placed where the full
  // tree has them (half as many, each 1.45× bigger ≈ the same leaf area), so the
  // crown keeps its outline and the switch from LOD0 doesn't shrink it
  const b1 = new MeshBuilder()
  tubes(b1, reduced.segments, LOD_SIDES[1])
  cards(b1, full.leaves, 2, 1.45)

  // LOD2 — bare main limbs; the leaves merged into a few clumps. The crown is cut
  // into cells, and each of the fullest cells becomes one ellipsoid fitted to
  // the leaves inside it (not a fixed size), so the clumps trace the crown.
  const b2 = new MeshBuilder()
  tubes(b2, trunk.segments, LOD_SIDES[2], 1)
  const cell = sp.height * 0.32
  const cells = new Map<string, { lo: Vector3; hi: Vector3; col: Color; n: number }>()
  for (const l of full.leaves) {
    const key = l.pos.map((v) => Math.floor(v / cell)).join(',')
    const c = cells.get(key) ?? {
      lo: new Vector3(Infinity, Infinity, Infinity),
      hi: new Vector3(-Infinity, -Infinity, -Infinity),
      col: new Color(0, 0, 0),
      n: 0,
    }
    for (const q of cardPoints(l)) {
      c.lo.min(q)
      c.hi.max(q)
    }
    c.col.add(leafColor(l))
    c.n++
    cells.set(key, c)
  }
  const clusters = [...cells.values()].sort((a, b) => b.n - a.n).slice(0, 8)
  clusters.forEach((c, k) => {
    const centre = c.lo.clone().add(c.hi).multiplyScalar(0.5)
    // a solid clump looks heavier than loose cards with sky between them,
    // so it's a little smaller than the box the leaves fill, and a little darker
    const half = c.hi.clone().sub(c.lo).multiplyScalar(0.5 * 0.8)
    const min = cell * 0.18
    // drop rank: the biggest clump holds on longest in autumn
    const rank = 0.05 + ((k + 0.5) / clusters.length) * 0.9
    b2.blob(
      centre,
      Math.max(half.x, min),
      Math.max(half.y, min),
      Math.max(half.z, min),
      c.col.multiplyScalar(0.9 / c.n),
      k >= 3, // the three biggest clumps are smooth; small ones can be cruder
      rank,
    )
  })

  // LOD3 — a trunk stick + one ellipsoid covering the whole crown, in the colour
  // the full tree averages to
  const b3 = new MeshBuilder()
  const pts = full.leaves.length
    ? full.leaves.flatMap(cardPoints)
    : full.segments.map((s) => new Vector3(...s.end))
  const lo = new Vector3(Infinity, Infinity, Infinity)
  const hi = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const p of pts) {
    lo.min(p)
    hi.max(p)
  }
  const mid = lo.clone().add(hi).multiplyScalar(0.5)
  const half = hi.clone().sub(lo).multiplyScalar(0.5 * 0.85)
  const crownBase = new Vector3(mid.x, lo.y + half.y * 0.4, mid.z)
  b3.tube(
    {
      start: [0, 0, 0],
      end: [crownBase.x, crownBase.y, crownBase.z],
      r0: full.segments[0]?.r0 ?? 0.05,
      r1: (full.segments[0]?.r0 ?? 0.05) * 0.7,
      depth: 0,
    },
    3,
    barkA,
  )
  b3.blob(
    mid,
    Math.max(half.x, 0.15),
    Math.max(half.y, 0.15),
    Math.max(half.z, 0.15),
    b0.averageColor(),
  )

  const builders = [b0, b1, b2, b3]
  return {
    lods: builders.map((b) => b.toGeometry()),
    tris: builders.map((b) => b.triangles()),
    branches: full.segments.length,
    leaves: full.leaves.length,
    generations: full.generations,
  }
}

/** Seed for variant `i`. `seed` is the user's global seed — change it and every variant regrows. */
const variantSeed = (species: Species, i: number, seed: number) =>
  species.name.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 17) * 977 +
  i * 7919 +
  seed * 104729

/** `count` unique trees from one recipe, each with its four LODs. */
export function buildVariants(sp: Species, count: number, seed = 0): TreeLods[] {
  const out: TreeLods[] = []
  for (let i = 0; i < count; i++) {
    out.push(buildTreeLods(generateTreeStages(sp, variantSeed(sp, i, seed)), sp))
  }
  return out
}
