import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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
 * Height → biome colour. Cut points scale with amplitude (see BANDS) and shift
 * with sea level, so raising/lowering the water floods or drains the coast
 * instead of just sliding a plane through unrelated-looking ground colours.
 */
function makeRamp(amplitude: number, seaLevel: number) {
  return [
    { max: seaLevel, color: COLORS.water },
    { max: seaLevel + BANDS.sand * amplitude, color: COLORS.sand },
    { max: seaLevel + BANDS.grass * amplitude, color: COLORS.grass },
    { max: seaLevel + BANDS.rock * amplitude, color: COLORS.rock },
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

// reach full white coverage after ~25s of steady snowfall at Amount = 1,
// melt back over ~50s once it stops — lingers a bit rather than vanishing
const SNOW_BUILD_RATE = 1 / 25
const SNOW_MELT_RATE = 1 / 50
// only touch the GPU color buffer once accumulation has moved this much,
// so an idle scene (fully snowed or fully melted) does no per-frame work
const SNOW_UPDATE_STEP = 0.01

export function Terrain({
  params,
  wireframe = false,
  snowing = false,
  snowIntensity = 1,
  running = true,
}: {
  params: TerrainParams
  wireframe?: boolean
  snowing?: boolean
  snowIntensity?: number
  running?: boolean
}) {
  // `baseColors` is the pure biome ramp, computed once and never mutated —
  // the snow coat is always blended FROM this, so build-up and melt-back
  // stay consistent instead of drifting from repeated in-place lerps.
  // `snowable` excludes water: the river/seabed is a flat constant height,
  // and real snow doesn't settle on flowing water anyway.
  const { geometry, baseColors, snowable } = useMemo(() => {
    const segments = Math.round(
      THREE.MathUtils.clamp(params.resolution, 8, 400),
    )
    const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, segments, segments)
    geo.rotateX(-Math.PI / 2) // lie flat: local +Z becomes world up

    const pos = geo.attributes.position
    const baseColors = new Float32Array(pos.count * 3)
    const snowable = new Uint8Array(pos.count)
    const ramp = makeRamp(params.amplitude, params.seaLevel)
    const c = new THREE.Color()

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = height(x, z, params)
      pos.setY(i, y)

      biomeColor(y, ramp, c)
      baseColors[i * 3] = c.r
      baseColors[i * 3 + 1] = c.g
      baseColors[i * 3 + 2] = c.b
      snowable[i] = y > params.seaLevel ? 1 : 0
    }

    pos.needsUpdate = true
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(Float32Array.from(baseColors), 3),
    )
    geo.computeVertexNormals() // fix lighting after displacing vertices
    return { geometry: geo, baseColors, snowable }
  }, [params])

  // free the old geometry when params change
  useEffect(() => () => geometry.dispose(), [geometry])

  const snowAmountRef = useRef(0)
  const appliedRef = useRef(0)

  // the color buffer above always starts snow-free, so reset the tracked
  // amount whenever the terrain (and therefore that buffer) regenerates
  useEffect(() => {
    snowAmountRef.current = 0
    appliedRef.current = 0
  }, [geometry])

  useFrame((_, delta) => {
    const rate = !running
      ? 0 // paused: freeze accumulation in place, same as rain/cloud drift
      : snowing
        ? SNOW_BUILD_RATE * Math.max(0.15, snowIntensity)
        : -SNOW_MELT_RATE
    if (rate !== 0) {
      snowAmountRef.current = THREE.MathUtils.clamp(
        snowAmountRef.current + rate * delta,
        0,
        1,
      )
    }

    const amt = snowAmountRef.current
    if (Math.abs(amt - appliedRef.current) < SNOW_UPDATE_STEP) return
    appliedRef.current = amt

    const colorAttr = geometry.attributes.color as THREE.BufferAttribute
    const arr = colorAttr.array as Float32Array
    const sr = COLORS.snow.r
    const sg = COLORS.snow.g
    const sb = COLORS.snow.b

    for (let i = 0; i < snowable.length; i++) {
      if (!snowable[i]) continue
      const i3 = i * 3
      arr[i3] = baseColors[i3] + (sr - baseColors[i3]) * amt
      arr[i3 + 1] = baseColors[i3 + 1] + (sg - baseColors[i3 + 1]) * amt
      arr[i3 + 2] = baseColors[i3 + 2] + (sb - baseColors[i3 + 2]) * amt
    }
    colorAttr.needsUpdate = true
  })

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
