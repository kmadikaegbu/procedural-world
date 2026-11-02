import { height, type TerrainParams } from '../noise'
import { islandWeight, islandWiden, urbanWeight } from '../world/region'
import { coastDistance } from '../world/shore'

/**
 * HABITAT — where the animals can live, on a grid over the area around
 * Roosevelt Island.
 *
 * A cell is LAND when it's above the coast and above the sea, and WILD when
 * it's land the city hasn't paved. "Paved" uses the same rule that clears the
 * trees in Props.tsx, so the animals live exactly where the forest is drawn.
 *
 * Each cell also stores a step toward the nearest wild cell (a breadth-first
 * search outward from every wild cell at once). An animal stranded on paved
 * ground follows those steps back to the wild. If there are none, its whole
 * patch of land has been paved and it has nowhere to go.
 */

/** The area the animals live in, in world units: the island, the East Side of Manhattan, and western Queens. */
export const AREA = { x0: -120, x1: 120, z0: -120, z1: 120 }
/** Grid cell size, in world units (~67 m). */
export const CELL = 2
export const NX = (AREA.x1 - AREA.x0) / CELL
export const NZ = (AREA.z1 - AREA.z0) / CELL

const STRAIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const

export class Habitat {
  /** Terrain height at each cell's centre. */
  ground = new Float32Array(NX * NZ)
  private coast = new Float32Array(NX * NZ)
  private island = new Float32Array(NX * NZ)

  land = new Uint8Array(NX * NZ)
  wild = new Uint8Array(NX * NZ)
  /** One step toward the nearest wild cell over land (the cell itself if wild, -1 if none). */
  next = new Int32Array(NX * NZ)
  /** The same, over land and water, for birds. */
  nextAir = new Int32Array(NX * NZ)
  /** Every wild cell, for picking one at random. */
  wildCells: number[] = []
  /** Share of the land that is still wild, 0..1: how many animals it can hold. */
  wildShare = 1

  /** Re-sample the terrain. Call when its shape changes. */
  build(params: TerrainParams) {
    const widen = islandWiden(params)
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i
        const x = AREA.x0 + (i + 0.5) * CELL
        const z = AREA.z0 + (j + 0.5) * CELL
        this.ground[k] = height(x, z, params)
        this.coast[k] = coastDistance(x, z, widen)
        this.island[k] = islandWeight(x, z, widen)
      }
    }
  }

  /** Re-decide what's land and what's wild. Cheap: call when the sea or the city moves. */
  update(seaLevel: number, cityReach: number, paving: number) {
    let landCount = 0
    this.wildCells = []
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i
        const x = AREA.x0 + (i + 0.5) * CELL
        const z = AREA.z0 + (j + 0.5) * CELL
        const land = this.coast[k] > 0.3 && this.ground[k] > seaLevel + 0.02
        const built = paving * urbanWeight(x, z, cityReach) * (1 - this.island[k]) >= 0.5
        this.land[k] = land ? 1 : 0
        this.wild[k] = land && !built ? 1 : 0
        if (land) landCount++
        if (land && !built) this.wildCells.push(k)
      }
    }
    this.wildShare = landCount > 0 ? this.wildCells.length / landCount : 0
    this.flow(this.next, true)
    this.flow(this.nextAir, false)
  }

  /** Breadth-first search out from every wild cell; each cell records the neighbour it was reached from. */
  private flow(next: Int32Array, landOnly: boolean) {
    next.fill(-1)
    const queue = new Int32Array(NX * NZ)
    let head = 0
    let tail = 0
    for (let k = 0; k < next.length; k++) {
      if (this.wild[k]) {
        next[k] = k
        queue[tail++] = k
      }
    }
    while (head < tail) {
      const k = queue[head++]
      const i = k % NX
      const j = (k - i) / NX
      // over land, only straight steps: a diagonal could slip between two
      // water cells and walk an animal across a river
      for (const [di, dj] of landOnly ? STRAIGHT : NEIGHBOURS) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
        const n = nj * NX + ni
        if (next[n] !== -1 || (landOnly && !this.land[n])) continue
        next[n] = k
        queue[tail++] = n
      }
    }
  }

  /** The cell under (x, z), clamped to the area. */
  cellAt(x: number, z: number): number {
    const i = Math.min(NX - 1, Math.max(0, Math.floor((x - AREA.x0) / CELL)))
    const j = Math.min(NZ - 1, Math.max(0, Math.floor((z - AREA.z0) / CELL)))
    return j * NX + i
  }

  /** Centre of cell k. */
  centre(k: number): { x: number; z: number } {
    const i = k % NX
    return { x: AREA.x0 + (i + 0.5) * CELL, z: AREA.z0 + ((k - i) / NX + 0.5) * CELL }
  }

  /**
   * Where a stranded animal at (x, z) should head: a few steps along the flow,
   * so it walks in a straight-ish line rather than cell to cell. Null when no
   * wild land can be reached.
   */
  wayOut(x: number, z: number, air: boolean): { x: number; z: number } | null {
    const next = air ? this.nextAir : this.next
    let k = this.cellAt(x, z)
    if (next[k] === -1) return null
    // a few cells ahead in the air; on the ground only two, so the straight
    // line there can't cut across water
    for (let s = 0; s < (air ? 6 : 2) && next[k] !== k; s++) k = next[k]
    return this.centre(k)
  }

  /** A random wild cell's centre, or null when nothing is wild. */
  randomWild(rand: () => number): { x: number; z: number } | null {
    const cells = this.wildCells
    if (cells.length === 0) return null
    const c = this.centre(cells[Math.floor(rand() * cells.length)])
    // anywhere inside the cell, so newcomers don't line up on the grid
    return { x: c.x + (rand() - 0.5) * CELL, z: c.z + (rand() - 0.5) * CELL }
  }
}
