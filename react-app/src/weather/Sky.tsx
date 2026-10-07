import { useMemo } from 'react'
import * as THREE from 'three'
import { Sky as DreiSky, Stars } from '@react-three/drei'
import { skyTint, type WeatherParams } from './presets'

// Sky dome + sun light + fog, all derived from the weather params.
export function Sky({ params }: { params: WeatherParams }) {
  const { sunElevation, sunAzimuth, cloudCover, fogDensity } = params

  // sun direction on a unit sphere from elevation + azimuth
  const sunPosition = useMemo<[number, number, number]>(() => {
    const phi = Math.PI / 2 - sunElevation * (Math.PI / 2)
    const theta = sunAzimuth
    return [
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ]
  }, [sunElevation, sunAzimuth])

  const day = THREE.MathUtils.clamp(sunElevation * 3, 0, 1)
  const sunIntensity = day * (1 - cloudCover * 0.7) * 3
  const ambient = 0.15 + day * 0.35
  const tint = skyTint(sunElevation)

  // fogDensity 0..1 → exp2 fog density (tuned for a ~100-unit map)
  const fogAmount = 0.004 + fogDensity * 0.03

  return (
    <>
      <fogExp2 attach="fog" args={[tint, fogAmount]} />
      <color attach="background" args={[tint]} />

      <DreiSky
        distance={450000}
        sunPosition={sunPosition}
        turbidity={2 + cloudCover * 8}
        rayleigh={sunElevation < 0.2 ? 3 : 1}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      {sunElevation < 0.1 && (
        <Stars radius={120} depth={40} count={2500} factor={3} fade />
      )}

      <hemisphereLight args={['#ffd9b3', '#3a2b33', ambient]} />
      <directionalLight
        castShadow
        position={[sunPosition[0] * 40, sunPosition[1] * 40 + 5, sunPosition[2] * 40]}
        intensity={sunIntensity}
        color={sunElevation < 0.3 ? '#ffce9e' : '#fff3e0'}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
    </>
  )
}
