import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { height, MAP_SIZE, shapeKey, type TerrainParams } from './noise'
import { BIOME_COLORS, landColor, makeRamp } from './biomes'
import { createTerrainMaterial } from './grass/grassMaterial'
import { GRASS_DEFAULTS, GRASS_SEASONS, type GrassSettings } from './grass/settings'
import type { Season } from './trees/seasons'
import { WEATHER_DEFAULTS, type WeatherParams } from '../weather/presets'
import { islandWeight, islandWiden } from './world/region'
import { axisLines } from './world/grid'
import { GroundCollider } from './GroundCollider'
import { DETAIL_HALF, WORLD } from './world/shore'

export { MAP_SIZE }

// reach full white coverage after ~25s of steady snowfall at Amount = 1,
// melt back over ~50s once it stops — lingers a bit rather than vanishing
const SNOW_BUILD_RATE = 1 / 25
const SNOW_MELT_RATE = 1 / 50
// only touch the GPU color buffer once accumulation has moved this much,
// so an idle scene (fully snowed or fully melted) does no per-frame work
const SNOW_UPDATE_STEP = 0.01

// Grid spacing far from the island, in world units (~100 m). Around it the
// spacing is set by the Resolution slider (default 0.5 ≈ 17 m).
const COARSE_STEP = 3

/**
 * The ground: the whole city as one mesh — fine around Roosevelt Island, growing
 * coarser toward the edges (see world/grid.ts). `quality="low"` builds a much
 * lighter mesh, for the minimap.
 */
export function Terrain({
  params,
  quality = 'high',
  wireframe = false,
  snowing = false,
  snowIntensity = 1,
  running = true,
  grass = GRASS_DEFAULTS,
  season = 'summer',
  weather = WEATHER_DEFAULTS,
}: {
  params: TerrainParams
  quality?: 'high' | 'low'
  wireframe?: boolean
  snowing?: boolean
  snowIntensity?: number
  running?: boolean
  /** Look of the grass (see grass/settings.ts). */
  grass?: GrassSettings
  /** The same season the trees use — it yellows or freshens the grass. */
  season?: Season
  /** Wind rolls sheen across the grass; rain wets it. */
  weather?: WeatherParams
}) {
  // biome colours per vertex + procedural grass per pixel (grass/grassMaterial.ts)
  const { material, uniforms } = useMemo(() => createTerrainMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.wireframe = wireframe
  }, [material, wireframe])

  // SHAPE: where every vertex is. This depends on everything that moves the
  // ground — but NOT on sea level, which only changes colours. (The climate
  // timeline changes sea level every frame; rebuilding ~160,000 vertices for
  // that would stall it.)
  const { geometry, ys, island } = useMemo(() => {
    const segments = Math.round(THREE.MathUtils.clamp(params.resolution, 8, 400))
    const low = quality === 'low'
    const fine = low ? 3 : MAP_SIZE / segments
    const coarse = low ? 6 : Math.max(COARSE_STEP, fine)
    const xs = axisLines(WORLD.x0, WORLD.x1, fine, coarse, DETAIL_HALF)
    const zs = axisLines(WORLD.z0, WORLD.z1, fine, coarse, DETAIL_HALF)
    const nx = xs.length
    const nz = zs.length
    const count = nx * nz

    const positions = new Float32Array(count * 3)
    const ys = new Float32Array(count)
    const island = new Float32Array(count) // 1 on Roosevelt Island (always parkland), 0 elsewhere
    const widen = islandWiden(params)
    for (let j = 0; j < nz; j++) {
      const z = zs[j]
      for (let i = 0; i < nx; i++) {
        const x = xs[i]
        const k = j * nx + i
        const y = height(x, z, params)
        positions[k * 3] = x
        positions[k * 3 + 1] = y
        positions[k * 3 + 2] = z
        ys[k] = y
        island[k] = islandWeight(x, z, widen)
      }
    }

    // two triangles per grid cell
    const index = new Uint32Array((nx - 1) * (nz - 1) * 6)
    let n = 0
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i
        const b = a + 1
        const c = a + nx
        const d = c + 1
        index[n++] = a
        index[n++] = c
        index[n++] = b
        index[n++] = b
        index[n++] = c
        index[n++] = d
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geo.setAttribute('aIsland', new THREE.BufferAttribute(island, 1))
    geo.setIndex(new THREE.BufferAttribute(index, 1))
    geo.computeVertexNormals() // fix lighting after displacing vertices
    geo.computeBoundingSphere()
    return { geometry: geo, ys, island }
    // sea level is deliberately absent — see above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, params.resolution, ...shapeKey(params)])

  // free the old geometry when the shape changes
  useEffect(() => () => geometry.dispose(), [geometry])

  // COLOUR: from each vertex's height relative to sea level. `baseColors` is
  // the pure biome colouring, never mutated — the snow coat is always blended
  // FROM it, so build-up and melt-back stay consistent instead of drifting from
  // repeated in-place lerps. `snowable` excludes water: the river is a flat
  // constant depth, and real snow doesn't settle on flowing water anyway.
  const { baseColors, snowable } = useMemo(() => {
    const ramp = makeRamp(params.amplitude, params.seaLevel)
    const c = new THREE.Color()
    const baseColors = new Float32Array(ys.length * 3)
    const snowable = new Uint8Array(ys.length)
    for (let k = 0; k < ys.length; k++) {
      // parkland where there's no paving; Roosevelt Island is always parkland
      landColor(ys[k], ramp, Math.max(1 - grass.paving, island[k]), c)
      baseColors[k * 3] = c.r
      baseColors[k * 3 + 1] = c.g
      baseColors[k * 3 + 2] = c.b
      snowable[k] = ys[k] > params.seaLevel ? 1 : 0
    }
    return { baseColors, snowable }
  }, [ys, island, params.amplitude, params.seaLevel, grass.paving])

  const snowAmountRef = useRef(0)
  const appliedRef = useRef(-1)
  const timeRef = useRef(0)
  const wetRef = useRef(0)

  // new colours land in the GPU buffer; -1 makes the next frame re-blend the snow coat over them
  useLayoutEffect(() => {
    const attr = geometry.attributes.color as THREE.BufferAttribute
    ;(attr.array as Float32Array).set(baseColors)
    attr.needsUpdate = true
    appliedRef.current = -1
  }, [geometry, baseColors])

  useFrame((_, delta) => {
    // --- grass: feed the shader this frame's numbers ---
    const u = uniforms
    if (running) {
      timeRef.current += Math.min(delta, 0.1)
      // grass soaks up rain over ~6 s, and takes ~20 s to dry once it stops
      const target = weather.precip === 'rain' ? weather.precipIntensity : 0
      const speed = target > wetRef.current ? 1 / 6 : 1 / 20
      wetRef.current += (target - wetRef.current) * Math.min(1, delta * speed)
    }
    u.uTime.value = timeRef.current
    u.uWet.value = wetRef.current
    u.uWind.value = weather.wind
    u.uSea.value = params.seaLevel
    u.uPaving.value = grass.paving
    u.uAmp.value = params.amplitude
    u.uLush.value = grass.lushness
    u.uPatch.value = grass.patchiness
    u.uDetail.value = grass.detail
    u.uSheen.value = grass.windSheen
    u.uBare.value = grass.bareSlopes
    u.uLushColor.value.set(grass.lushColor)
    u.uDryColor.value.set(grass.dryColor)
    u.uSoilColor.value.set(grass.soilColor)
    const grassSeason = GRASS_SEASONS[season]
    u.uSeasonTint.value.set(grassSeason.tint)
    u.uSeasonMix.value = grassSeason.mix
    u.uSeasonDry.value = grassSeason.dry
    u.uSnow.value = snowAmountRef.current

    // --- snow coat on the vertex colours ---
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
    const sr = BIOME_COLORS.snow.r
    const sg = BIOME_COLORS.snow.g
    const sb = BIOME_COLORS.snow.b

    for (let i = 0; i < snowable.length; i++) {
      const i3 = i * 3
      if (!snowable[i]) {
        // keep water at its plain colour, even if a coat was applied before the sea rose
        arr[i3] = baseColors[i3]
        arr[i3 + 1] = baseColors[i3 + 1]
        arr[i3 + 2] = baseColors[i3 + 2]
        continue
      }
      arr[i3] = baseColors[i3] + (sr - baseColors[i3]) * amt
      arr[i3 + 1] = baseColors[i3 + 1] + (sg - baseColors[i3 + 1]) * amt
      arr[i3 + 2] = baseColors[i3 + 2] + (sb - baseColors[i3 + 2]) * amt
    }
    colorAttr.needsUpdate = true
  })

  return (
    <>
      <mesh
        geometry={geometry}
        material={material}
        receiveShadow
        castShadow
        raycast={() => null} // the brushes use the hidden, lighter copy below
      />
      {/* the minimap has no brushes, so it skips building one */}
      {quality === 'high' && <GroundCollider params={params} />}
    </>
  )
}
