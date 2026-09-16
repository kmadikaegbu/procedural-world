import { Clouds as DreiClouds, Cloud } from '@react-three/drei'
import * as THREE from 'three'
import type { WeatherParams } from './presets'

// A band of volumetric clouds whose count / opacity / darkness track cloudCover.
export function Clouds({
  params,
  running = true,
}: {
  params: WeatherParams
  running?: boolean
}) {
  const { cloudCover, sunElevation } = params
  if (cloudCover < 0.05) return null

  const puffs = Math.round(1 + cloudCover * 4)
  const grey = sunElevation < 0.25 ? 0.35 : 0.85 - cloudCover * 0.4
  const tint = new THREE.Color(grey, grey, grey * 1.02)

  return (
    <DreiClouds material={THREE.MeshLambertMaterial} limit={200}>
      {Array.from({ length: puffs }, (_, i) => (
        <Cloud
          key={i}
          seed={i + 1}
          position={[(i - puffs / 2) * 18, 24 + (i % 2) * 4, -10 + i * 6]}
          bounds={[22, 4, 12]}
          volume={10}
          color={tint}
          opacity={0.35 + cloudCover * 0.5}
          speed={running ? 0.2 : 0}
          growth={4}
        />
      ))}
    </DreiClouds>
  )
}
