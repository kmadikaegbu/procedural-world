import { Terrain } from './Terrain'
import { Water } from './water/WaterSurface'
import type { WaterSettings } from './water/settings'
import type { WeatherParams } from '../weather/presets'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'
import type { Forest } from './trees/forest'
import type { LodReadout } from './trees/lod'

export { TERRAIN_DEFAULTS }
export type { TerrainParams }

/**
 * The whole procedural map. `params` drives terrain shape, biome colors, AND
 * prop placement — they all read the same object, so one slider reshapes
 * everything at once. Lift `params` into a useState in the parent and pass a
 * setter to your control panel.
 */
export function Map({
  params = TERRAIN_DEFAULTS,
  forest,
  water,
  weather,
  main = false,
  onLodStats,
  onPlaced,
  wireframe = false,
  snowing = false,
  snowIntensity = 1,
  running = true,
}: {
  params?: TerrainParams
  /** The trees: placement, shapes, LOD, look, season, ivy (see trees/forest.ts). */
  forest: Forest
  /** Look of the sea (see water/settings.ts); the weather's wind and rain also shape it. */
  water?: WaterSettings
  weather?: WeatherParams
  /** The main 3D view rather than the minimap — LOD and stats only apply here. */
  main?: boolean
  onLodStats?: (r: LodReadout) => void
  onPlaced?: (drawn: number, fit: number) => void
  wireframe?: boolean
  /** Is it actively snowing right now — builds a white coat on the ground. */
  snowing?: boolean
  /** Scales how fast the snow coat builds (ties to the Amount slider). */
  snowIntensity?: number
  /** Paused freezes accumulation in place, same as rain/cloud drift. */
  running?: boolean
}) {
  return (
    <group>
      <Terrain
        params={params}
        wireframe={wireframe}
        snowing={snowing}
        snowIntensity={snowIntensity}
        running={running}
      />
      {/* water sits at params.seaLevel — the same reference the terrain's
          biome ramp and tree placement use, so raising it actually floods
          the coast instead of just sliding a plane past mismatched colors */}
      <Water
        params={params}
        settings={water}
        weather={weather}
        running={running}
        detail={main ? 'high' : 'low'}
      />
      {forest.show && (
        <Props
          params={params}
          forest={forest}
          main={main}
          onLodStats={onLodStats}
          onPlaced={onPlaced}
        />
      )}
    </group>
  )
}
