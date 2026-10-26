import { useEffect, useMemo } from 'react'
import type { TerrainParams } from '../noise'
import { buildIvyGeometry, growIvy, type IvySettings } from './ivy'
import type { TreeMaterials } from './materials'
import type { PlacedTree } from './scatter'

/** All the ivy as ONE mesh, regrown when the terrain, trees or ivy settings change. */
export function IvyMesh({
  params,
  trees,
  settings,
  seed,
  materials,
  sizeRatio = 1,
}: {
  params: TerrainParams
  trees: PlacedTree[]
  settings: IvySettings
  seed: number
  materials: TreeMaterials
  /** 1 at the readable scale; smaller at true scale (see scale.ts). */
  sizeRatio?: number
}) {
  const geometry = useMemo(
    () =>
      settings.plants > 0
        ? buildIvyGeometry(growIvy(params, settings, trees, seed, sizeRatio))
        : null,
    [params, settings, trees, seed, sizeRatio],
  )
  // free the old mesh's GPU memory when it's replaced
  useEffect(() => () => geometry?.dispose(), [geometry])

  if (!geometry) return null
  return (
    <mesh
      geometry={geometry}
      material={materials.material}
      customDepthMaterial={materials.depth}
      castShadow
      receiveShadow
      raycast={() => null}
    />
  )
}
