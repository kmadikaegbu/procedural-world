import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { cellular3 } from './cellularNoise'

export type OrbNoiseParams = {
  // fractal Perlin layer
  amplitude: number
  frequency: number
  octaves: number
  persistence: number
  // cellular (Worley) layer
  cellularAmplitude: number
  cellularFrequency: number
  cellularJitter: number
  cellularCracks: boolean // F2−F1 grooves instead of F1 bumps
  // shared
  seed: number
  speed: number
  wireframe: boolean
  colorLow: string
  colorHigh: string
  gradientContrast: number
}

export const ORB_NOISE_DEFAULTS: OrbNoiseParams = {
  amplitude: 0.25,
  frequency: 1.6,
  octaves: 4,
  persistence: 0.5,
  cellularAmplitude: 0,
  cellularFrequency: 2.5,
  cellularJitter: 1,
  cellularCracks: false,
  seed: 0,
  speed: 0.3,
  wireframe: false,
  colorLow: '#e07a5f',
  colorHigh: '#f2cc8f',
  gradientContrast: 1,
}

const RADIUS = 1
const DETAIL = 48 // sphere segments

function NoisyOrb({ params = ORB_NOISE_DEFAULTS }: { params?: OrbNoiseParams }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const perlin = useMemo(() => new ImprovedNoise(), [])
  const cLow = useMemo(() => new THREE.Color(), [])
  const cHigh = useMemo(() => new THREE.Color(), [])
  const cTmp = useMemo(() => new THREE.Color(), [])

  // base (undistorted) sphere positions, working geometry, scratch buffers
  const { geometry, basePositions, dispVals } = useMemo(() => {
    const geo = new THREE.SphereGeometry(RADIUS, DETAIL * 2, DETAIL)
    const base = Float32Array.from(geo.attributes.position.array)
    const count = geo.attributes.position.count
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    )
    return { geometry: geo, basePositions: base, dispVals: new Float32Array(count) }
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const update = (time: number) => {
    const {
      amplitude,
      frequency,
      octaves,
      persistence,
      cellularAmplitude,
      cellularFrequency,
      cellularJitter,
      cellularCracks,
      seed,
      colorLow,
      colorHigh,
      gradientContrast,
    } = params
    const pos = geometry.attributes.position
    const col = geometry.attributes.color as THREE.BufferAttribute
    const v = new THREE.Vector3()

    let min = Infinity
    let max = -Infinity

    // pass 1: displace each vertex by (fractal Perlin) + (cellular) layers
    for (let i = 0; i < pos.count; i++) {
      const bx = basePositions[i * 3]
      const by = basePositions[i * 3 + 1]
      const bz = basePositions[i * 3 + 2]

      // --- fractal Perlin ---
      let n = 0
      let amp = 1
      let freq = frequency
      for (let o = 0; o < octaves; o++) {
        n +=
          perlin.noise(
            bx * freq + seed,
            by * freq + seed,
            bz * freq + seed + time,
          ) * amp
        amp *= persistence
        freq *= 2
      }
      let disp = n * amplitude

      // --- cellular (Worley) ---
      if (cellularAmplitude !== 0) {
        const cf = cellularFrequency
        const { f1, f2 } = cellular3(
          bx * cf + seed,
          by * cf + seed,
          bz * cf + seed + time,
          cellularJitter,
          seed,
        )
        const c = cellularCracks
          ? (f2 - f1) - 0.3 // grooves at cell borders
          : 0.5 - f1 // domes at cell centres
        disp += c * cellularAmplitude
      }

      dispVals[i] = disp
      if (disp < min) min = disp
      if (disp > max) max = disp

      v.set(bx, by, bz).normalize()
      const scale = RADIUS + disp
      pos.setXYZ(i, v.x * scale, v.y * scale, v.z * scale)
    }

    // pass 2: gradient color from normalized surface height
    cLow.set(colorLow)
    cHigh.set(colorHigh)
    const span = max - min || 1
    for (let i = 0; i < pos.count; i++) {
      let t = (dispVals[i] - min) / span
      t = Math.pow(t, gradientContrast)
      cTmp.copy(cLow).lerp(cHigh, t)
      col.setXYZ(i, cTmp.r, cTmp.g, cTmp.b)
    }

    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.computeVertexNormals()
  }

  // initial build + whenever params change
  useEffect(() => {
    update(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useFrame((state) => {
    if (params.speed > 0) update(state.clock.elapsedTime * params.speed)
    if (meshRef.current) meshRef.current.rotation.y += 0.0015
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        emissive={params.colorHigh}
        emissiveIntensity={0.15}
        roughness={0.35}
        metalness={0.1}
        wireframe={params.wireframe}
      />
    </mesh>
  )
}

export default NoisyOrb
