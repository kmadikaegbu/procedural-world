import { Terrain } from './Terrain'
import { Water } from './Water'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'

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
  showTrees = true,
  treeCount = 400,
  scatterSeed = 0,
  wireframe = false,
  snowing = false,
  snowIntensity = 1,
  running = true,
}: {
  params?: TerrainParams
  showTrees?: boolean
  treeCount?: number
  scatterSeed?: number
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
      <Water level={params.seaLevel} />
      {showTrees && (
        <Props params={params} count={treeCount} scatterSeed={scatterSeed} />
      )}
    </group>
  )
}
