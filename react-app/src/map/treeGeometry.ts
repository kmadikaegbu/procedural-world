import { BufferAttribute, BufferGeometry, Color, Vector3 } from 'three'
import { generateTree, type Species, type TreeSkeleton } from './lsystem'

/**
 * TreeSkeleton → ONE BufferGeometry (branch tubes + leaf cards, vertex-coloured).
 *
 * One geometry per tree variant means the whole forest is a handful of
 * instanced draw calls (see Props.tsx) rather than thousands of meshes.
 *
 *   branch  = open tube, `sides` quads around, no end caps (the next segment or
 *             a leaf card hides the join; caps would just be wasted triangles)
 *   leaf    = a flat kite, 2 triangles
 */

const tmp = {
  d: new Vector3(),
  u: new Vector3(),
  v: new Vector3(),
  n: new Vector3(),
  a: new Vector3(),
  b: new Vector3(),
  c: new Vector3(),
}

export interface TreeGeometryOptions {
  /** Radial sides on trunk and limb tubes (3 = triangular, cheapest; 5–6 reads round). */
  sides?: number
  /** Radial sides on twigs (depth 2+) — too thin to show roundness, so keep it cheap. */
  twigSides?: number
}

export function buildTreeGeometry(
  sk: TreeSkeleton,
  sp: Species,
  { sides = 5, twigSides = 3 }: TreeGeometryOptions = {},
): BufferGeometry {
  const nLeaf = sk.leaves.length
  const sidesOf = (depth: number) => (depth >= 2 ? twigSides : sides)
  let tubeVerts = 0
  let tubeTris = 0
  for (const s of sk.segments) {
    const n = sidesOf(s.depth)
    tubeVerts += (n + 1) * 2 // seam vertex repeated → no wrap-around index math
    tubeTris += n * 2
  }
  const leafVerts = nLeaf * 4
  const nVerts = tubeVerts + leafVerts
  const nTris = tubeTris + nLeaf * 2

  const pos = new Float32Array(nVerts * 3)
  const nrm = new Float32Array(nVerts * 3)
  const col = new Float32Array(nVerts * 3)
  const idx = new Uint32Array(nTris * 3)
  let vi = 0 // next vertex
  let ii = 0 // next index

  // --- branches ---------------------------------------------------------
  const barkA = new Color(sp.bark[0])
  const barkB = new Color(sp.bark[1])
  const bark = new Color()
  let maxDepth = 1
  for (const s of sk.segments) maxDepth = Math.max(maxDepth, s.depth)

  for (const s of sk.segments) {
    const sides = sidesOf(s.depth)
    const { d, u, v } = tmp
    d.set(s.end[0] - s.start[0], s.end[1] - s.start[1], s.end[2] - s.start[2])
    d.normalize()
    // any vector not parallel to d gives a perpendicular frame
    u.set(0, 0, 1)
    if (Math.abs(d.z) > 0.9) u.set(1, 0, 0)
    u.crossVectors(d, u).normalize()
    v.crossVectors(d, u)

    bark.lerpColors(barkA, barkB, s.depth / maxDepth)

    const base = vi
    for (let ring = 0; ring < 2; ring++) {
      const p = ring === 0 ? s.start : s.end
      const r = ring === 0 ? s.r0 : s.r1
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2
        const cx = Math.cos(a)
        const sy = Math.sin(a)
        const nx = u.x * cx + v.x * sy
        const ny = u.y * cx + v.y * sy
        const nz = u.z * cx + v.z * sy
        const o = vi * 3
        pos[o] = p[0] + nx * r
        pos[o + 1] = p[1] + ny * r
        pos[o + 2] = p[2] + nz * r
        nrm[o] = nx
        nrm[o + 1] = ny
        nrm[o + 2] = nz
        col[o] = bark.r
        col[o + 1] = bark.g
        col[o + 2] = bark.b
        vi++
      }
    }
    const row = sides + 1
    for (let k = 0; k < sides; k++) {
      const a = base + k
      const b = a + 1
      const c = a + row
      const e = c + 1
      // counter-clockwise seen from outside → the outer face is the front face
      idx[ii++] = a
      idx[ii++] = b
      idx[ii++] = c
      idx[ii++] = b
      idx[ii++] = e
      idx[ii++] = c
    }
  }

  // --- leaves -----------------------------------------------------------
  // Shade the cards as if the canopy were a soft ball: the normal leans
  // outward from the canopy centre, so a plain flat card still reads rounded.
  const centre = new Vector3()
  for (const l of sk.leaves) centre.add(tmp.a.set(...l.pos))
  if (nLeaf) centre.divideScalar(nLeaf)

  const leafA = new Color(sp.leaf.colors[0])
  const leafB = new Color(sp.leaf.colors[1])
  const leafCol = new Color()

  for (const l of sk.leaves) {
    const { a: p0, b: dir, c: side, n } = tmp
    p0.set(...l.pos)
    dir.set(...l.dir).multiplyScalar(l.size)
    side.set(...l.side).multiplyScalar(l.size * 0.35)

    // kite: base, left shoulder, tip, right shoulder
    const q = [
      [p0.x, p0.y, p0.z],
      [
        p0.x + dir.x * 0.4 + side.x,
        p0.y + dir.y * 0.4 + side.y,
        p0.z + dir.z * 0.4 + side.z,
      ],
      [p0.x + dir.x, p0.y + dir.y, p0.z + dir.z],
      [
        p0.x + dir.x * 0.4 - side.x,
        p0.y + dir.y * 0.4 - side.y,
        p0.z + dir.z * 0.4 - side.z,
      ],
    ]

    // soft normal: outward from the canopy centre, nudged by the card's own facing
    n.set(l.dir[0], l.dir[1], l.dir[2]).cross(tmp.u.set(...l.side)) // face normal
    tmp.v.set(q[1][0] - centre.x, q[1][1] - centre.y, q[1][2] - centre.z).normalize()
    if (n.dot(tmp.v) < 0) n.negate()
    n.multiplyScalar(0.35).addScaledVector(tmp.v, 0.65).normalize()

    leafCol.lerpColors(leafA, leafB, l.mix)
    // darker toward the canopy's inside, brighter on the outside → cheap AO
    const shade = 0.78 + 0.22 * Math.min(1, Math.max(0, tmp.v.y * 0.5 + 0.5))
    leafCol.multiplyScalar(shade)

    const base = vi
    for (const p of q) {
      const o = vi * 3
      pos[o] = p[0]
      pos[o + 1] = p[1]
      pos[o + 2] = p[2]
      nrm[o] = n.x
      nrm[o + 1] = n.y
      nrm[o + 2] = n.z
      col[o] = leafCol.r
      col[o + 1] = leafCol.g
      col[o + 2] = leafCol.b
      vi++
    }
    // wound so the outward-facing side is the "front" (the material is double-sided,
    // but three flips normals on back faces — outside views must be front faces)
    const fn = tmp.u
      .set(q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2])
      .cross(tmp.v.set(q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]))
    if (fn.dot(n) >= 0) {
      idx.set([base, base + 1, base + 2, base, base + 2, base + 3], ii)
    } else {
      idx.set([base, base + 2, base + 1, base, base + 3, base + 2], ii)
    }
    ii += 6
  }

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nrm, 3))
  g.setAttribute('color', new BufferAttribute(col, 3))
  g.setIndex(new BufferAttribute(idx, 1))
  g.computeBoundingSphere()
  return g
}

/** Seeds for the variants of one species — fixed, so every reload grows the same trees. */
const variantSeed = (species: Species, i: number) =>
  species.name.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 17) * 977 +
  i * 7919

/** `count` unique trees from one recipe, ready to instance. */
export function buildVariants(
  sp: Species,
  count: number,
  opts?: TreeGeometryOptions,
): BufferGeometry[] {
  const out: BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    out.push(buildTreeGeometry(generateTree(sp, variantSeed(sp, i)), sp, opts))
  }
  return out
}
