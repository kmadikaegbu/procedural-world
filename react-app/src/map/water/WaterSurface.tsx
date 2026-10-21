import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, PlaneGeometry, type Mesh } from 'three'
import { MAP_SIZE, type TerrainParams } from '../noise'
import { skyTint, WEATHER_DEFAULTS, type WeatherParams } from '../../weather/presets'
import { buildDepthMap } from './depthMap'
import { WATER_DEFAULTS, type WaterSettings } from './settings'
import { createWaterMaterial } from './waterMaterial'
import { makeWaves, WAVE_COUNT } from './waves'

// How finely the surface is cut up. Waves are made by moving these points, so
// a finer mesh can show smaller waves. 192×192 ≈ 37,000 points; the minimap
// only needs a rough sheet.
const SEGMENTS = { high: 192, low: 40 }
const OVERCAST = new Color('#9aa2a8')

/**
 * The sea: a flat sheet at sea level whose shader makes it look like water.
 * All the real work is in waterMaterial.ts; this component feeds it numbers.
 */
export function Water({
  params,
  settings = WATER_DEFAULTS,
  weather = WEATHER_DEFAULTS,
  running = true,
  detail = 'high',
}: {
  params: TerrainParams
  settings?: WaterSettings
  weather?: WeatherParams
  /** Paused freezes the waves, like the clouds and rain. */
  running?: boolean
  detail?: 'high' | 'low'
}) {
  // the sheet itself: flat, lying in the x–z plane, centred on the map
  const geometry = useMemo(() => {
    const n = SEGMENTS[detail]
    return new PlaneGeometry(MAP_SIZE, MAP_SIZE, n, n).rotateX(-Math.PI / 2)
  }, [detail])
  useEffect(() => () => geometry.dispose(), [geometry])

  const { material, uniforms } = useMemo(() => createWaterMaterial(), [])
  useEffect(() => () => material.dispose(), [material])

  // The depth map depends on the terrain's shape — but NOT on sea level. The
  // climate timeline changes sea level every frame, and rebuilding the map each
  // time would waste work, so the map is keyed on every terrain field except it.
  const { seaLevel: _ignored, ...terrainOnly } = params
  void _ignored
  const depth = useMemo(
    () => buildDepthMap(params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(terrainOnly),
  )
  useEffect(() => () => depth.texture.dispose(), [depth])

  // the waves are chosen from the terrain seed and the Direction / Wave size sliders
  const waves = useMemo(
    () => makeWaves(params.seed, settings.direction, settings.waveScale),
    [params.seed, settings.direction, settings.waveScale],
  )

  const time = useRef(0)
  const mesh = useRef<Mesh>(null)
  useFrame((_, delta) => {
    const u = uniforms
    if (running) time.current += Math.min(delta, 0.1) // a dropped frame shouldn't jump the waves
    u.uTime.value = time.current
    u.uLevel.value = params.seaLevel
    if (mesh.current) mesh.current.position.y = params.seaLevel

    u.uDepthTex.value = depth.texture
    u.uDepthInfo.value.set(depth.hMin, depth.hRange, 0, 0)

    // wind (units/sec: ~1.5 calm … 6 storm) makes the sea taller and sharper-crested
    const roughness = Math.min(2, 0.5 + weather.wind * 0.25)
    u.uWaveHeight.value = settings.waveHeight * roughness
    u.uChop.value = Math.min(1, settings.choppiness * (0.7 + weather.wind * 0.08))
    for (let i = 0; i < WAVE_COUNT; i++) {
      const w = waves[i]
      u.uWaves.value[i].set(w.dirX, w.dirZ, w.k, w.weight)
      u.uWaveSpeed.value[i] = w.speed * settings.speed
    }

    // rain peppers the surface with ripple rings
    u.uRain.value = weather.precip === 'rain' ? weather.precipIntensity : 0
    u.uRipple.value = settings.ripples
    u.uClarity.value = settings.clarity
    u.uFoam.value = settings.foam
    u.uReflect.value = settings.reflection
    u.uShallow.value.set(settings.shallowColor)
    u.uDeep.value.set(settings.deepColor)
    // the water mirrors whatever colour the sky is right now (dusk, noon, night…)
    u.uSky.value.set(skyTint(weather.sunElevation))
    // under cloud the water reflects the clouds, not the sky colour behind them
    u.uSky.value.lerp(OVERCAST, Math.min(1, weather.cloudCover * 0.9))
  })

  return (
    <>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={material}
        position={[0, params.seaLevel, 0]}
        receiveShadow
        frustumCulled={false} // the waves move points a little, so the flat bounds would be slightly off
        raycast={() => null} // 37,000 points would make every mouse move slow; the collider below stands in
      />
      {/* An invisible flat sheet that takes the mouse clicks the real water would:
          brushing the river can raise new land. Two triangles instead of 74,000. */}
      <mesh
        position={[0, params.seaLevel, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        userData={{ ground: true }}
      >
        <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
      </mesh>
    </>
  )
}
