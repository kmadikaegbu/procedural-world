import { VoxelTerrain } from './VoxelTerrain'
import { Water } from './Water'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'

/**
 * Blocky stand-in for <Map>, reading the exact same TerrainParams — same
 * seed, island shape, sea level, biome bands — just voxelized instead of
 * shaded as a smooth mesh. No animated snow coat here (that mutates a
 * per-vertex color buffer; doing it per-instance across a rebuilt cube list
 * is a bigger job) and no wind on the trees; everything else matches <Map>.
 */
export function VoxelMap({
  params = TERRAIN_DEFAULTS,
  showTrees = true,
  treeCount = 400,
  scatterSeed = 0,
  wireframe = false,
}: {
  params?: TerrainParams
  showTrees?: boolean
  treeCount?: number
  scatterSeed?: number
  wireframe?: boolean
}) {
  return (
    <group>
      <VoxelTerrain params={params} wireframe={wireframe} />
      <Water level={params.seaLevel} />
      {showTrees && (
        <Props
          params={params}
          count={treeCount}
          scatterSeed={scatterSeed}
          voxel
        />
      )}
    </group>
  )
}
