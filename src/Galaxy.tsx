import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export type GalaxyParams = {
  count: number
  radius: number
  branches: number
  spin: number
  randomness: number
  randomnessPower: number
  size: number
  insideColor: string
  outsideColor: string
}

export const GALAXY_DEFAULTS: GalaxyParams = {
  count: 60000,
  radius: 5,
  branches: 4,
  spin: 1,
  randomness: 0.35,
  randomnessPower: 3,
  size: 0.015,
  insideColor: '#f2cc8f',
  outsideColor: '#e07a5f',
}

function Galaxy({ params = GALAXY_DEFAULTS }: { params?: GalaxyParams }) {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, colors } = useMemo(() => {
    const {
      count,
      radius,
      branches,
      spin,
      randomness,
      randomnessPower,
      insideColor,
      outsideColor,
    } = params

    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const cInside = new THREE.Color(insideColor)
    const cOutside = new THREE.Color(outsideColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const r = Math.random() * radius
      const branchAngle = ((i % branches) / branches) * Math.PI * 2
      const spinAngle = r * spin

      const randomX =
        Math.pow(Math.random(), randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        randomness *
        r
      const randomY =
        Math.pow(Math.random(), randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        randomness *
        r *
        0.5
      const randomZ =
        Math.pow(Math.random(), randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        randomness *
        r

      positions[i3] = Math.cos(branchAngle + spinAngle) * r + randomX
      positions[i3 + 1] = randomY
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + randomZ

      const mixed = cInside.clone().lerp(cOutside, r / radius)
      colors[i3] = mixed.r
      colors[i3 + 1] = mixed.g
      colors[i3 + 2] = mixed.b
    }

    return { positions, colors }
  }, [params])

  useFrame((_, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.05
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={params.size}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
      />
    </points>
  )
}

export default Galaxy
