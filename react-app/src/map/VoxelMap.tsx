import { VoxelTerrain } from './VoxelTerrain'
import { Water } from './Water'
import { Props } from './Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './noise'
import type { TreeSet } from './treeSet'
import type { LodReadout, LodSettings } from './lod'
import type { ScatterMask, ScatterSettings } from './scatter'

/**
 * Blocky stand-in for <Map>, reading the exact same TerrainParams — same
 * seed, island shape, sea level, biome bands — just voxelized instead of
 * shaded as a smooth mesh. No animated snow coat here (that mutates a
 * per-vertex color buffer; doing it per-instance across a rebuilt cube list
 * is a bigger job) and no wind on the trees; everything else matches <Map>.
 */
export function VoxelMap({
  params = TERRAIN_DEFAULTS,
  treeSet,
  scatter,
  mask,
  lod,
  onLodStats,
  onPlaced,
  showTrees = true,
  treeCount = 400,
  scatterSeed = 0,
  wireframe = false,
}: {
  params?: TerrainParams
  treeSet: TreeSet
  scatter?: ScatterSettings
  mask?: ScatterMask | null
  lod?: LodSettings
  onLodStats?: (r: LodReadout) => void
  onPlaced?: (drawn: number, fit: number) => void
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
          treeSet={treeSet}
          scatter={scatter}
          mask={mask}
          lod={lod}
          onLodStats={onLodStats}
          onPlaced={onPlaced}
          count={treeCount}
          scatterSeed={scatterSeed}
          voxel
        />
      )}
    </group>
  )
}
