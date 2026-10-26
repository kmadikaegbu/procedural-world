import type { IvySettings } from './ivy'
import type { LodSettings } from './lod'
import type { TreeLook } from './materials'
import type { ScatterMask, ScatterSettings } from './scatter'
import type { Season } from './seasons'
import type { TreeSet } from './treeSet'
import type { ScaleMode } from '../scale'

/**
 * Everything the scene needs to draw the forest, in one bundle, so the map
 * components can pass it straight through to <Props> without listing each part.
 * Built by useTreeControls (the panel's state).
 */
export interface Forest {
  show: boolean
  /** How many of the scattered trees to draw. */
  count: number
  scatterSeed: number
  treeSet: TreeSet
  scatter: ScatterSettings
  mask: ScatterMask
  lod: LodSettings
  look: TreeLook
  season: Season
  ivy: IvySettings
  /** Readable (exaggerated) or true-to-scale sizes — see scale.ts. */
  scaleMode: ScaleMode
}
