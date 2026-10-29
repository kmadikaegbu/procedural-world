import { useCallback, useMemo, useState } from 'react'
import type { Forest } from './forest'
import { IVY_DEFAULTS, type IvySettings } from './ivy'
import { LOD_DEFAULTS, type LodReadout, type LodSettings } from './lod'
import type { TreeLook } from './materials'
import { emptyMask, SCATTER_DEFAULTS, type ScatterMask, type ScatterSettings } from './scatter'
import type { Season } from './seasons'
import { paramsFromSpecies, useTreeSet, type TreeParams } from './treeSet'
import type { ScaleMode } from '../scale'

/**
 * All the state behind the tree panel, in one hook: App calls it once, hands
 * `forest` to the scene and the whole object to <TreePanel>.
 */
export function useTreeControls(scaleMode: ScaleMode) {
  const [showTrees, setShowTrees] = useState(true)
  const [treeCount, setTreeCount] = useState(6000)
  const [scatterSeed, setScatterSeed] = useState(0)

  // starts as the mixed preset forest; picking a species loads its recipe into the sliders
  const [tree, setTree] = useState<TreeParams>(() => ({
    ...paramsFromSpecies('open'),
    species: 'mixed',
  }))
  const treeMixed = tree.species === 'mixed'

  const [scatter, setScatter] = useState<ScatterSettings>(SCATTER_DEFAULTS)
  const treeSet = useTreeSet(tree, scatter.variants)

  // the painted planting zone, and the brush that edits it
  const [mask, setMask] = useState<ScatterMask>(emptyMask)
  const [maskTool, setMaskTool] = useState<'off' | 'paint' | 'erase'>('off')
  const [maskRadius, setMaskRadius] = useState(5)

  const [placed, setPlaced] = useState({ drawn: 0, fit: 0 })
  const onPlaced = useCallback(
    (drawn: number, fit: number) =>
      setPlaced((p) => (p.drawn === drawn && p.fit === fit ? p : { drawn, fit })),
    [],
  )

  const [look, setLook] = useState<TreeLook>('realistic')
  const [season, setSeason] = useState<Season>('summer')
  const [ivy, setIvy] = useState<IvySettings>(IVY_DEFAULTS)

  const [lod, setLod] = useState<LodSettings>(LOD_DEFAULTS)
  // the latest reading taken with LOD off and with it on — so both columns stay
  // filled after you flip the switch and can be compared side by side
  const [lodReadout, setLodReadout] = useState<{
    off: LodReadout | null
    on: LodReadout | null
  }>({ off: null, on: null })
  const onLodStats = useCallback(
    (r: LodReadout) =>
      setLodReadout((prev) => ({ ...prev, [r.enabled ? 'on' : 'off']: r })),
    [],
  )
  // keep the three distances in order: moving one pushes its neighbours along
  const setLodThreshold = useCallback(
    (i: number, v: number) =>
      setLod((l) => {
        const t = [...l.thresholds] as LodSettings['thresholds']
        t[i] = v
        for (let j = i + 1; j < 3; j++) t[j] = Math.max(t[j], t[j - 1] + 5)
        for (let j = i - 1; j >= 0; j--) t[j] = Math.min(t[j], t[j + 1] - 5)
        return { ...l, thresholds: t }
      }),
    [],
  )

  const forest: Forest = useMemo(
    () => ({
      show: showTrees,
      count: treeCount,
      scatterSeed,
      treeSet,
      scatter,
      mask,
      lod,
      look,
      season,
      ivy,
      scaleMode,
    }),
    [showTrees, treeCount, scatterSeed, treeSet, scatter, mask, lod, look, season, ivy, scaleMode],
  )

  return {
    forest,
    showTrees, setShowTrees,
    treeCount, setTreeCount,
    scatterSeed, setScatterSeed,
    tree, setTree, treeMixed, treeSet,
    scatter, setScatter,
    mask, setMask, maskTool, setMaskTool, maskRadius, setMaskRadius,
    placed, onPlaced,
    look, setLook, season, setSeason,
    ivy, setIvy,
    lod, setLod, setLodThreshold, lodReadout, onLodStats,
  }
}

export type TreeControls = ReturnType<typeof useTreeControls>
