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
  seaLevel = 0,
  showTrees = true,
  treeCount = 400,
  scatterSeed = 0,
  wireframe = false,
}: {
  params?: TerrainParams
  seaLevel?: number
  showTrees?: boolean
  treeCount?: number
  scatterSeed?: number
  wireframe?: boolean
}) {
  return (
    <group>
      <Terrain params={params} wireframe={wireframe} />
      <Water level={seaLevel} />
      {showTrees && (
        <Props params={params} count={treeCount} scatterSeed={scatterSeed} />
      )}
    </group>
  )
}
