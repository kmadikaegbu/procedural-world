import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, type Mesh } from 'three'
import { MAP_SIZE, shapeKey, type TerrainParams } from '../noise'
import { axisLines } from '../world/grid'
import { DETAIL_HALF, WORLD } from '../world/shore'
import { skyTint, WEATHER_DEFAULTS, type WeatherParams } from '../../weather/presets'
import { buildDepthMap } from './depthMap'
import { WATER_DEFAULTS, type WaterSettings } from './settings'
import { createWaterMaterial } from './waterMaterial'
import { makeWaves, WAVE_COUNT } from './waves'
import { EXAGGERATION, m, ratios, type ScaleMode } from '../scale'

// How finely the surface is cut up. Waves are made by moving these points, so
// a finer mesh can show smaller waves. Around Roosevelt Island: 192 cells across
// the 100-unit detail square (~0.5 units); the minimap only needs a rough sheet.
// Far from the island the mesh thins to one cell per COARSE_STEP units, where
// nobody is looking at individual waves.
const SEGMENTS = { high: 192, low: 40 }
const COARSE_STEP = 4
// the coarse (whole-city) depth map: one pixel per this many world units
const WIDE_CELL = 2.4
const WIDE_RES = {
  x: Math.ceil((WORLD.x1 - WORLD.x0) / WIDE_CELL),
  z: Math.ceil((WORLD.z1 - WORLD.z0) / WIDE_CELL),
}
const DETAIL_AREA = { x0: -DETAIL_HALF, x1: DETAIL_HALF, z0: -DETAIL_HALF, z1: DETAIL_HALF }
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
  scaleMode = 'readable',
}: {
  params: TerrainParams
  settings?: WaterSettings
  weather?: WeatherParams
  /** Paused freezes the waves, like the clouds and rain. */
  running?: boolean
  detail?: 'high' | 'low'
  /** Readable or true-to-scale — sets how much the wave height is enlarged. */
  scaleMode?: ScaleMode
}) {
  // the sheet itself: flat, lying in the x–z plane, with grid lines packed
  // closely around the island and spread out toward the city's edges
  const geometry = useMemo(() => {
    const fine = MAP_SIZE / SEGMENTS[detail]
    const xs = axisLines(WORLD.x0, WORLD.x1, fine, COARSE_STEP, DETAIL_HALF)
    const zs = axisLines(WORLD.z0, WORLD.z1, fine, COARSE_STEP, DETAIL_HALF)
    const nx = xs.length
    const nz = zs.length
    const pos = new Float32Array(nx * nz * 3)
    const nrm = new Float32Array(nx * nz * 3)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3
        pos[k] = xs[i]
        pos[k + 2] = zs[j]
        nrm[k + 1] = 1 // the shader works out the real normal; this just fills the slot
      }
    }
    const index = new Uint32Array((nx - 1) * (nz - 1) * 6)
    let n = 0
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i
        const c = a + nx
        index[n++] = a
        index[n++] = c
        index[n++] = a + 1
        index[n++] = a + 1
        index[n++] = c
        index[n++] = c + 1
      }
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    geo.setAttribute('normal', new BufferAttribute(nrm, 3))
    geo.setIndex(new BufferAttribute(index, 1))
    return geo
  }, [detail])
  useEffect(() => () => geometry.dispose(), [geometry])

  const { material, uniforms } = useMemo(() => createWaterMaterial(), [])
  useEffect(() => () => material.dispose(), [material])

  // The depth map depends on the terrain's shape — but NOT on sea level. The
  // climate timeline changes sea level every frame, and rebuilding the map each
  // time would waste work, so the map is keyed on the shape of the ground only.
  const terrainKey = shapeKey(params)
  const depth = useMemo(
    () => buildDepthMap(params, DETAIL_AREA, 256, 256),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    terrainKey,
  )
  useEffect(() => () => depth.texture.dispose(), [depth])
  // the coarse map over the whole city
  const wide = useMemo(
    () => buildDepthMap(params, WORLD, WIDE_RES.x, WIDE_RES.z),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    terrainKey,
  )
  useEffect(() => () => wide.texture.dispose(), [wide])

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
    u.uVScale.value = ratios(scaleMode).vertical
    if (mesh.current) mesh.current.position.y = params.seaLevel

    u.uDepthTex.value = depth.texture
    u.uDepthInfo.value.set(depth.hMin, depth.hRange, 0, 0)
    u.uUseWide.value = 1
    u.uWideTex.value = wide.texture
    u.uWideInfo.value.set(wide.hMin, wide.hRange, WORLD.x0, WORLD.z0)
    u.uWideSize.value.set(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0, 0, 0)

    // wind (units/sec: ~1.5 calm … 6 storm) makes the sea taller and sharper-crested
    const roughness = Math.min(2, 0.5 + weather.wind * 0.25)
    // wave height: real metres × the vertical factor, the same one the hills use
    u.uWaveHeight.value = m(settings.waveHeight) * EXAGGERATION[scaleMode].vertical * roughness
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
        position={[(WORLD.x0 + WORLD.x1) / 2, params.seaLevel, (WORLD.z0 + WORLD.z1) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        userData={{ ground: true }}
      >
        <planeGeometry args={[WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0]} />
      </mesh>
    </>
  )
}
