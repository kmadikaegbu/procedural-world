import { VoxelTerrain } from './VoxelTerrain'
import { Water } from './Water'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'
import type { Forest } from './trees/forest'
import type { LodReadout } from './trees/lod'

/**
 * Blocky stand-in for <Map>, reading the exact same TerrainParams — same
 * seed, island shape, sea level, biome bands — just voxelized instead of
 * shaded as a smooth mesh. No animated snow coat here (that mutates a
 * per-vertex color buffer; doing it per-instance across a rebuilt cube list
 * is a bigger job) and no wind on the trees; everything else matches <Map>.
 */
export function VoxelMap({
  params = TERRAIN_DEFAULTS,
  forest,
  onLodStats,
  onPlaced,
  wireframe = false,
}: {
  params?: TerrainParams
  forest: Forest
  onLodStats?: (r: LodReadout) => void
  onPlaced?: (drawn: number, fit: number) => void
  wireframe?: boolean
}) {
  return (
    <group>
      <VoxelTerrain params={params} wireframe={wireframe} />
      <Water level={params.seaLevel} />
      {forest.show && (
        <Props
          params={params}
          forest={forest}
          main // VoxelMap is only ever the main view
          onLodStats={onLodStats}
          onPlaced={onPlaced}
          voxel
        />
      )}
    </group>
  )
}
