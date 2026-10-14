import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import { height, type TerrainParams } from '../noise'
import { LOD_COLORS } from './lod'

const RING_SEGMENTS = 72
const RING_WIDTH = 0.6

/**
 * LOD debug view: a ring on the ground at each switch distance, centred under
 * the camera. A tree inside the first ring is drawn at LOD0, between the first
 * and second at LOD1, and so on.
 */
export function LodRings({
  params,
  thresholds,
}: {
  params: TerrainParams
  thresholds: readonly [number, number, number]
}) {
  // one flat ribbon (a strip of quads) per ring; positions are rewritten as the camera moves
  const geometries = useMemo(
    () =>
      [0, 1, 2].map(() => {
        const g = new BufferGeometry()
        const verts = (RING_SEGMENTS + 1) * 2
        g.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3))
        const idx: number[] = []
        for (let k = 0; k < RING_SEGMENTS; k++) {
          const a = k * 2
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
        }
        g.setIndex(idx)
        return g
      }),
    [],
  )
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const last = useRef({ x: NaN, y: NaN, z: NaN, key: '', params, t: 0 })

  useFrame((state) => {
    const cam = state.camera.position
    const l = last.current
    const key = thresholds.join()
    const moved =
      Math.abs(cam.x - l.x) + Math.abs(cam.y - l.y) + Math.abs(cam.z - l.z) > 0.05 ||
      key !== l.key ||
      params !== l.params
    // ring heights come from the noise function, so don't redo them every frame
    if (!moved || state.clock.elapsedTime - l.t < 0.08) return
    Object.assign(l, { x: cam.x, y: cam.y, z: cam.z, key, params, t: state.clock.elapsedTime })

    // distance is measured in 3D, so the ground radius is what's left after the camera's height
    const dy = cam.y - height(cam.x, cam.z, params)
    thresholds.forEach((R, i) => {
      const r = Math.sqrt(Math.max(R * R - dy * dy, 0))
      const pos = geometries[i].getAttribute('position') as BufferAttribute
      for (let k = 0; k <= RING_SEGMENTS; k++) {
        const a = (k / RING_SEGMENTS) * Math.PI * 2
        const c = Math.cos(a)
        const s = Math.sin(a)
        const y = height(cam.x + c * r, cam.z + s * r, params) + 0.4
        pos.setXYZ(k * 2, cam.x + c * (r - RING_WIDTH / 2), y, cam.z + s * (r - RING_WIDTH / 2))
        pos.setXYZ(k * 2 + 1, cam.x + c * (r + RING_WIDTH / 2), y, cam.z + s * (r + RING_WIDTH / 2))
      }
      pos.needsUpdate = true
    })
  })

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} frustumCulled={false} renderOrder={10} raycast={() => null}>
          {/* ring i is the switch into level i+1, so it wears that level's colour */}
          <meshBasicMaterial color={LOD_COLORS[i + 1]} side={DoubleSide} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}
