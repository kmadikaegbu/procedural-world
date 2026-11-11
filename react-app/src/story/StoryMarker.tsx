/**
 * THE STORY ON THE MAP: marks where the current chapter happened. A beacon of
 * light with a label stands on the spot, with a pulsing ring at its foot; a
 * chapter can add a line (the wall, a bridge, the first subway), an outlined
 * area (Central Park) or a circle (a fire, a flood). See chapters.ts.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { DoubleSide, Shape, type Mesh } from 'three'
import { height, type TerrainParams } from '../map/noise'
import { KX, KZ, LAT0, LON0, at, km } from '../map/world/project'
import type { LatLon, Where } from './chapters'

const TONES = {
  story: '#48cae4',
  fire: '#ff7a3d',
  water: '#4f8dff',
  park: '#6ee08f',
} as const

/** Ground (or water) height at a world point, plus a lift so the marks sit just above it. */
function groundAt(x: number, z: number, params: TerrainParams, lift: number) {
  return Math.max(height(x, z, params), params.seaLevel) + lift
}

/** A lat/lon path as world points along the ground, filled in so it follows the hills. */
function drape(path: LatLon[], params: TerrainParams, lift: number, closed = false): [number, number, number][] {
  const pts = path.map(([lat, lon]) => at(lat, lon))
  if (closed) pts.push(pts[0])
  const out: [number, number, number][] = []
  for (let i = 0; i < pts.length; i++) {
    const [x0, z0] = pts[i]
    const [x1, z1] = pts[i + 1] ?? pts[i]
    const steps = i + 1 < pts.length ? Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.5)) : 1
    for (let s = 0; s < steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps
      const z = z0 + ((z1 - z0) * s) / steps
      out.push([x, groundAt(x, z, params, lift), z])
      if (i + 1 >= pts.length) break
    }
  }
  return out
}

/** A circle of `radiusKm` around a point, as a lat/lon ring (the projection run backwards). */
function circle(centre: LatLon, radiusKm: number): LatLon[] {
  const [cx, cz] = at(...centre)
  const r = km(radiusKm)
  const out: LatLon[] = []
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const x = cx + Math.cos(a) * r
    const z = cz + Math.sin(a) * r
    out.push([LAT0 - z / KZ, LON0 + x / KX])
  }
  return out
}

export function StoryMarker({ where, params }: { where: Where; params: TerrainParams }) {
  const color = TONES[where.tone ?? 'story']
  const ring = useRef<Mesh>(null)

  const marks = useMemo(() => {
    const [x, z] = at(...where.at)
    const ground = groundAt(x, z, params, 0.05)
    // the beacon grows with how far back the camera stands, so it reads at every chapter's view
    const tall = Math.max(4, where.view * 0.16)
    const outline = where.ring ?? (where.km ? circle(where.at, where.km) : null)
    let fill: { shape: Shape; y: number } | null = null
    let edge: [number, number, number][] | null = null
    if (outline) {
      edge = drape(outline, params, 0.3, true)
      const flat = outline.map(([lat, lon]) => at(lat, lon))
      const shape = new Shape()
      // the shape is drawn in x / −z, then laid flat (rotated −90° about x)
      flat.forEach(([px, pz], i) => (i ? shape.lineTo(px, -pz) : shape.moveTo(px, -pz)))
      fill = { shape, y: Math.max(...edge.map((p) => p[1])) + 0.05 }
    }
    const line = where.path ? drape(where.path, params, 0.4) : null
    return { x, z, ground, tall, fill, edge, line }
  }, [where, params])

  useFrame(({ clock }) => {
    const r = ring.current
    if (!r) return
    const t = (clock.elapsedTime % 2) / 2
    r.scale.setScalar(0.4 + t * 1.6)
    ;(r.material as { opacity: number }).opacity = 0.7 * (1 - t)
  })

  if (!where.label) return null
  const { x, z, ground, tall, fill, edge, line } = marks
  const width = Math.max(0.08, tall * 0.012)

  return (
    <group>
      {/* the beacon */}
      <mesh position={[x, ground + tall / 2, z]} renderOrder={10} visible={where.beacon !== false}>
        <cylinderGeometry args={[width, width, tall, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} side={DoubleSide} />
      </mesh>
      <mesh visible={where.beacon !== false} position={[x, ground + tall, z]}>
        <sphereGeometry args={[width * 3, 16, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* the pulse at its foot */}
      <mesh visible={where.beacon !== false} ref={ring} position={[x, ground + 0.1, z]} rotation-x={-Math.PI / 2} renderOrder={10}>
        <ringGeometry args={[tall * 0.18, tall * 0.22, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} side={DoubleSide} />
      </mesh>

      {line && <Line points={line} color={color} lineWidth={5} transparent opacity={0.95} />}
      {edge && <Line points={edge} color={color} lineWidth={3} transparent opacity={0.95} />}
      {fill && (
        <mesh position-y={fill.y} rotation-x={-Math.PI / 2} renderOrder={9}>
          <shapeGeometry args={[fill.shape]} />
          <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} side={DoubleSide} />
        </mesh>
      )}

      <Html position={[x, ground + tall, z]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
        <div className="story-label" style={{ borderColor: color }}>
          {where.label}
        </div>
      </Html>
    </group>
  )
}
