import { BoxGeometry, BufferGeometry, CircleGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AgentState, Species } from './sim'

/**
 * Low-poly bodies, each 1 unit long, facing +z, feet at y = 0. They're scaled
 * to each animal's real length when drawn. At the distance the camera views
 * them from, a silhouette is all that reads, so a few boxes are enough.
 */

function box(w: number, h: number, l: number, x: number, y: number, z: number): BufferGeometry {
  return new BoxGeometry(w, h, l).translate(x, y, z)
}

function deer(): BufferGeometry {
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => box(0.07, 0.45, 0.07, sx * 0.1, 0.225, sz * 0.24)),
  )
  return mergeGeometries([
    box(0.28, 0.32, 0.62, 0, 0.6, 0), // body
    box(0.12, 0.3, 0.12, 0, 0.82, 0.3), // neck
    box(0.14, 0.14, 0.26, 0, 0.98, 0.4), // head
    ...legs,
  ])
}

function fox(): BufferGeometry {
  const legs = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => box(0.05, 0.2, 0.05, sx * 0.07, 0.1, sz * 0.18)),
  )
  return mergeGeometries([
    box(0.2, 0.2, 0.5, 0, 0.3, 0), // body
    box(0.16, 0.14, 0.24, 0, 0.36, 0.34), // head and snout
    box(0.1, 0.1, 0.38, 0, 0.3, -0.42), // tail
    ...legs,
  ])
}

/**
 * A chevron: two swept-back wings, 1 unit from tip to tip, tips raised so it
 * still shows when seen edge-on. Scaling its height flaps the wings.
 */
function bird(): BufferGeometry {
  const g = new BufferGeometry()
  // nose, left tip, tail notch, right tip
  const p = [0, 0, 0.25, -0.5, 0.2, -0.15, 0, 0, -0.08, 0.5, 0.2, -0.15]
  g.setAttribute('position', new Float32BufferAttribute(p, 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.computeVertexNormals()
  return g
}

export const BODIES: Record<Species, BufferGeometry> = { bird: bird(), deer: deer(), fox: fox() }

/** A flat wedge on the ground, radius 1, centred on +z: a fox's cone of vision. */
export function visionCone(fov: number): BufferGeometry {
  return new CircleGeometry(1, 24, -Math.PI / 2 - fov / 2, fov).rotateX(-Math.PI / 2)
}

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
}
