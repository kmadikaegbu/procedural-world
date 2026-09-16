import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BANDS, height, MAP_SIZE, type TerrainParams } from './noise'

export { MAP_SIZE }

const COLORS = {
  water: new THREE.Color('#4a6d7c'),
  sand: new THREE.Color('#d9c8a0'),
  grass: new THREE.Color('#81b29a'),
  rock: new THREE.Color('#8a7f76'),
  snow: new THREE.Color('#f4efe6'),
}

/**
 * Height → biome colour. Cut points scale with amplitude (see BANDS) so the
 * mix holds together whatever relief you dial in.
 */
function makeRamp(amplitude: number) {
  return [
    { max: 0, color: COLORS.water },
    { max: BANDS.sand * amplitude, color: COLORS.sand },
    { max: BANDS.grass * amplitude, color: COLORS.grass },
    { max: BANDS.rock * amplitude, color: COLORS.rock },
    { max: Infinity, color: COLORS.snow },
  ]
}

function biomeColor(
  y: number,
  ramp: ReturnType<typeof makeRamp>,
  out: THREE.Color,
): THREE.Color {
  for (let b = 1; b < ramp.length; b++) {
    if (y <= ramp[b].max) {
      const lo = ramp[b - 1]
      const hi = ramp[b]
      const t = THREE.MathUtils.clamp((y - lo.max) / (hi.max - lo.max), 0, 1)
      return out.copy(lo.color).lerp(hi.color, t)
    }
  }
  return out.copy(ramp[ramp.length - 1].color)
}

export function Terrain({
  params,
  wireframe = false,
}: {
  params: TerrainParams
  wireframe?: boolean
}) {
  const geometry = useMemo(() => {
    const segments = Math.round(
      THREE.MathUtils.clamp(params.resolution, 8, 400),
    )
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments)
    geo.rotateX(-Math.PI / 2) // lie flat: local +Z becomes world up

    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const ramp = makeRamp(params.amplitude)
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = height(x, z, params)
      pos.setY(i, y)

      biomeColor(y, ramp, c)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    pos.needsUpdate = true
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals() // fix lighting after displacing vertices
    return geo
  }, [params])

  // free the old geometry when params change
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.92}
        metalness={0}
        wireframe={wireframe}
      />
    </mesh>
  )
}
