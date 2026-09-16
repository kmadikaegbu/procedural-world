import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Precip } from './presets'

// Falling particles inside a box volume centred on the origin. When a particle
// drops below the floor it wraps back to the top, so a fixed pool loops forever.
const AREA = 60 // width/depth of the rain box
const TOP = 30 // spawn height
const FLOOR = -4 // wrap height
const MAX = 6000 // particle pool size (scaled down by intensity)

export function Precipitation({
  kind,
  intensity,
  wind,
  running = true,
}: {
  kind: Precip
  intensity: number
  wind: number
  running?: boolean
}) {
  const pointsRef = useRef<THREE.Points>(null)
  const snow = kind === 'snow'

  const count = Math.floor(MAX * THREE.MathUtils.clamp(intensity, 0, 1))

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(MAX * 3)
    const speeds = new Float32Array(MAX)
    for (let i = 0; i < MAX; i++) {
      positions[i * 3] = (Math.random() - 0.5) * AREA
      positions[i * 3 + 1] = Math.random() * (TOP - FLOOR) + FLOOR
      positions[i * 3 + 2] = (Math.random() - 0.5) * AREA
      speeds[i] = 0.5 + Math.random() * 0.7
    }
    return { positions, speeds }
  }, [])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useFrame((_, delta) => {
    if (!running) {
      geometry.setDrawRange(0, count) // stay visible, just frozen in place
      return
    }
    const d = Math.min(delta, 0.1)
    const fall = (snow ? 4 : 26) * d
    const drift = wind * d
    const sway = snow ? Math.sin(performance.now() * 0.001) * 0.4 : 0
    const arr = geometry.attributes.position.array as Float32Array

    for (let i = 0; i < count; i++) {
      arr[i * 3] += drift * speeds[i] + sway * d * 20
      arr[i * 3 + 1] -= fall * speeds[i]
      if (arr[i * 3 + 1] < FLOOR) {
        arr[i * 3] = (Math.random() - 0.5) * AREA
        arr[i * 3 + 1] = TOP
        arr[i * 3 + 2] = (Math.random() - 0.5) * AREA
      }
      // keep inside the box horizontally
      if (arr[i * 3] > AREA / 2) arr[i * 3] -= AREA
      if (arr[i * 3] < -AREA / 2) arr[i * 3] += AREA
    }
    geometry.attributes.position.needsUpdate = true
    geometry.setDrawRange(0, count)
  })

  if (kind === 'none' || count === 0) return null

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={snow ? '#f4efe6' : '#9fb4c4'}
        size={snow ? 0.14 : 0.07}
        transparent
        opacity={snow ? 0.9 : 0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
