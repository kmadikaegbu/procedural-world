import { Terrain } from './Terrain'
import { Water } from './water/WaterSurface'
import type { WaterSettings } from './water/settings'
import type { GrassSettings } from './grass/settings'
import type { WeatherParams } from '../weather/presets'
import { Props } from './Props'
import { City } from './city/City'
import { Wildlife } from './wildlife/Wildlife'
import type { WildlifeSettings } from './wildlife/settings'
import type { WildlifeStats } from './wildlife/sim'
import { CITY_REACH_ALL } from './timeline'
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
  grass,
  weather,
  main = false,
  quality = 'high',
  year,
  wildlife,
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
  /** Look of the grass (see grass/settings.ts); season and weather also change it. */
  grass?: GrassSettings
  weather?: WeatherParams
  /** The main 3D view rather than the minimap — LOD and stats only apply here. */
  main?: boolean
  /** The timeline's year: set it to draw the city's buildings and streets as they were then (main view only). */
  year?: number
  /** The animals (main view only): their settings, a restart counter, and a live readout. */
  wildlife?: { settings: WildlifeSettings; resetKey: number; onStats?: (s: WildlifeStats) => void }
  /** 'low' builds much lighter ground and water meshes — for the minimap. */
  quality?: 'high' | 'low'
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
        quality={quality}
        wireframe={wireframe}
        snowing={snowing}
        snowIntensity={snowIntensity}
        running={running}
        grass={grass}
        season={forest.season}
        weather={weather}
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
        scaleMode={forest.scaleMode}
      />
      {main && year !== undefined && (
        <City params={params} year={year} scaleMode={forest.scaleMode} />
      )}
      {main && wildlife?.settings.show && (
        <Wildlife
          params={params}
          settings={wildlife.settings}
          resetKey={wildlife.resetKey}
          onStats={wildlife.onStats}
          cityReach={grass?.cityReach ?? CITY_REACH_ALL}
          paving={grass?.paving ?? 1}
          running={running}
          scaleMode={forest.scaleMode}
          weather={weather}
          season={forest.season}
        />
      )}
      {forest.show && (
        <Props
          params={params}
          forest={forest}
          grass={grass}
          main={main}
          onLodStats={onLodStats}
          onPlaced={onPlaced}
        />
      )}
    </group>
  )
}
