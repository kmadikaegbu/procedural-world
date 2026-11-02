import {
  BoxGeometry,
  ConeGeometry,
  ExtrudeGeometry,
  Shape,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Kind } from './layout'

/**
 * THE BUILDING SHAPES. Every building is one of five shapes, each drawn once and
 * then stamped thousands of times (instancing). A shape is built to a unit size:
 * its footprint is 1 × 1 and its height is 1, standing on y = 0. Each building
 * then stretches it to its own width, depth and height, so a setback tower keeps
 * its proportions however tall it is.
 */

function flat(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g
  out.deleteAttribute('uv') // the shapes are textured by the shader, not by uv
  return out
}

/** A box of the given size whose bottom sits at height `y0`. */
function box(w: number, h: number, d: number, y0: number): BufferGeometry {
  return flat(new BoxGeometry(w, h, d).translate(0, y0 + h / 2, 0))
}

function build(kind: Kind): BufferGeometry {
  switch (kind) {
    case Kind.House: {
      // a house with a gabled roof: walls to 62 % of its height, the ridge at the top
      const s = new Shape()
      s.moveTo(-0.5, 0)
      s.lineTo(0.5, 0)
      s.lineTo(0.5, 0.62)
      s.lineTo(0, 1)
      s.lineTo(-0.5, 0.62)
      s.closePath()
      return flat(new ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5))
    }
    case Kind.Block:
      return mergeGeometries([box(1, 1, 1, 0)])
    case Kind.Setback:
      // an Art Deco tower: it steps in as it climbs, and ends in a spire
      return mergeGeometries([
        box(1, 0.5, 1, 0),
        box(0.72, 0.28, 0.72, 0.5),
        box(0.46, 0.15, 0.46, 0.78),
        box(0.12, 0.07, 0.12, 0.93),
      ])
    case Kind.Slab:
      // a plain tower with the machinery box on the roof
      return mergeGeometries([box(1, 0.97, 1, 0), box(0.5, 0.03, 0.5, 0.97)])
    case Kind.Crown:
      // a tall shaft capped with a pyramid
      return mergeGeometries([
        box(1, 0.88, 1, 0),
        flat(new ConeGeometry(0.62, 0.12, 4).rotateY(Math.PI / 4).translate(0, 0.94, 0)),
      ])
  }
}

export const KINDS = [Kind.House, Kind.Block, Kind.Setback, Kind.Slab, Kind.Crown] as const

/** One geometry per kind, indexed by Kind. */
export function buildShapes(): BufferGeometry[] {
  return KINDS.map((k) => build(k))
}
