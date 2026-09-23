import { Clouds as DreiClouds, Cloud } from '@react-three/drei'
import * as THREE from 'three'
import type { WeatherParams } from './presets'

// A band of volumetric cloud puffs. cloudCover sets the overall dimming/haze
// (see Sky.tsx); the puffs themselves — how many, how big, how high, how fast
// they churn — are independently controlled here.
export function Clouds({
  params,
  running = true,
}: {
  params: WeatherParams
  running?: boolean
}) {
  const {
    cloudCover,
    sunElevation,
    cloudCount,
    cloudAltitude,
    cloudSpread,
    cloudSize,
    cloudOpacity,
    cloudSpeed,
    cloudSeed,
  } = params
  const puffs = Math.round(cloudCount)
  if (cloudCover < 0.05 || puffs <= 0) return null

  const grey = sunElevation < 0.25 ? 0.35 : 0.85 - cloudCover * 0.4
  const tint = new THREE.Color(grey, grey, grey * 1.02)
  const opacity = THREE.MathUtils.clamp(cloudOpacity + cloudCover * 0.3, 0, 1)

  return (
    <DreiClouds material={THREE.MeshLambertMaterial} limit={200}>
      {Array.from({ length: puffs }, (_, i) => (
        <Cloud
          key={i}
          seed={i + 1 + cloudSeed}
          position={[
            (i - puffs / 2) * cloudSpread,
            cloudAltitude + (i % 2) * 4,
            -10 + i * 6,
          ]}
          bounds={[22, 4, 12]}
          volume={cloudSize}
          color={tint}
          opacity={opacity}
          speed={running ? cloudSpeed : 0}
          growth={4}
        />
      ))}
    </DreiClouds>
  )
}
