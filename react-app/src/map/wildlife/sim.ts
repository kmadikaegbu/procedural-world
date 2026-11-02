import { height, makeRng, type TerrainParams } from '../noise'
import { AREA, Habitat } from './habitat'
import type { WildlifeSettings } from './settings'

/**
 * THE WILDLIFE SIMULATION — agents, each following a few simple rules.
 *
 * BIRDS flock (Craig Reynolds' boids, 1987). Each bird only looks at the birds
 * near it and follows three rules: line up with them (alignment), move toward
 * them (cohesion), and don't crowd them (separation). Nobody leads; the flock's
 * shape comes out of those rules.
 *
 * DEER and FOXES are state machines: each is in one state at a time and
 * switches when something happens.
 *
 *   deer   graze ──fox close──▶ flee ──fox gone──▶ graze
 *   fox    wander ──hungry, sees a deer──▶ hunt ──catches it──▶ eat ──▶ rest ──▶ wander
 *                                               └──loses it──▶ wander
 *
 * A fox only sees deer inside its cone of vision (ahead of it, not behind).
 * Hunger rises all the time; a fox that catches nothing for too long starves.
 * A fox that eats may raise a kit. So foxes depend on deer, and deer numbers
 * depend on foxes and on land: a small ecosystem.
 *
 * Every species also has two states driven by the city:
 *
 *   displaced  standing on land the city has paved: walk (or fly) back to the
 *              nearest wild land, following the habitat's flow field
 *   leaving    nowhere wild left to reach, starved, caught, or more animals
 *              than the wild land can hold: shrink away and are removed
 *
 * How many of each the area holds is its maximum (the Wildlife sliders) times
 * the share of the land that's still wild. As the History Timeline paves the
 * city, that share falls and the animals retreat to what's left: by today,
 * Roosevelt Island.
 *
 * Time here is sped up, like the timeline: speeds are in world units (33.5 m)
 * per second, so a fleeing deer covers ~150 m a second. Read it as a diagram
 * of behaviour, not a nature film.
 */

export type Species = 'bird' | 'deer' | 'fox'
export const SPECIES: Species[] = ['bird', 'deer', 'fox']

export type AgentState =
  | 'flock'
  | 'graze'
  | 'flee'
  | 'wander'
  | 'hunt'
  | 'eat'
  | 'rest'
  | 'displaced'
  | 'leaving'

export interface Agent {
  id: number
  species: Species
  state: AgentState
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  /** Facing, radians around +y (0 = +z). */
  heading: number
  /** Ground animals' walking speed. */
  speed: number
  /** Seconds left in the current state (or the current stretch of grazing). */
  timer: number
  /** Foxes: 0 = just ate, 1 = starving. */
  hunger: number
  /** Drawn size, 0..1: grows in when born, shrinks out when leaving. */
  grow: number
  /** Birds: preferred height above the ground. */
  alt: number
  /** Foxes: the deer being chased. */
  prey: Agent | null
}

// --- tuning (world units and seconds) -----------------------------------------

/** Real body lengths, metres (wingspan for the birds: gull- and goose-sized, so they read from the air). */
export const REAL_LENGTH: Record<Species, number> = { bird: 1.5, deer: 1.9, fox: 1.1 }

const BIRD = {
  sight: 12, // neighbours this close count for the flocking rules
  crowd: 2, // …and closer than this, they push apart
  align: 0.8,
  cohere: 0.3,
  separate: 6,
  minSpeed: 4,
  maxSpeed: 9,
  altitude: [5, 10] as const, // height above the ground, varies per bird
}
const DEER = {
  walk: 0.8,
  run: 4.5,
  homeward: 2, // displaced deer walk this fast
  wary: 10, // flee from a fox closer than this
  safe: 16, // …and stop once it's this far away
  herd: 15, // drift back toward other deer within this
}
export const FOX = {
  walk: 1.3,
  run: 5.2, // a little faster than a fleeing deer, so some chases succeed
  sight: 14, // how far a fox can see…
  fov: (130 * Math.PI) / 180, // …inside this cone
  catch: 1, // close enough to catch
  giveUp: 20, // the deer got this far ahead
  chaseTime: 7,
  hungry: 0.3, // only hunts once this hungry
  starve: 50, // seconds without food until it starves
  eatTime: 3,
  restTime: 4,
}

/** Births per second when a species is below what the land holds: at least this… */
const MIN_RATE: Record<Species, number> = { bird: 3, deer: 0.8, fox: 0.1 }
/** …or this share of the shortfall, whichever is more. */
const SHORTFALL_RATE = 0.25

let nextId = 1

export interface WildlifeStats {
  wildShare: number
  /** How many of each species, by state. */
  counts: Record<Species, Partial<Record<AgentState, number>>>
  totals: Record<Species, number>
  capacity: Record<Species, number>
}

export class WildlifeSim {
  agents: Agent[] = []
  readonly habitat = new Habitat()
  private rand = makeRng(1609)
  private births: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }
  private departures: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }

  capacity(sp: Species, s: WildlifeSettings): number {
    const max = sp === 'bird' ? s.birds : sp === 'deer' ? s.deer : s.foxes
    return Math.round(max * this.habitat.wildShare)
  }

  /** Start over: every species filled to what the land holds, fully grown. */
  populate(s: WildlifeSettings, params: TerrainParams) {
    this.agents = []
    for (const sp of SPECIES) {
      const n = this.capacity(sp, s)
      for (let i = 0; i < n; i++) this.spawn(sp, params, 1)
    }
  }

  step(dt: number, s: WildlifeSettings, params: TerrainParams) {
    const birds: Agent[] = []
    const deer: Agent[] = []
    const foxes: Agent[] = []
    for (const a of this.agents) {
      if (a.species === 'bird') birds.push(a)
      else if (a.species === 'deer') deer.push(a)
      else foxes.push(a)
    }
    for (const b of birds) this.stepBird(b, birds, dt, params)
    for (const d of deer) this.stepDeer(d, deer, foxes, dt, params)
    for (const f of foxes) this.stepFox(f, deer, foxes, dt, s, params)

    this.balance(dt, s, params)
    // newborns start at size 0 too, so only the ones leaving are removed
    this.agents = this.agents.filter((a) => a.state !== 'leaving' || a.grow > 0)
  }

  // --- birds ---------------------------------------------------------------------

  private stepBird(b: Agent, birds: Agent[], dt: number, params: TerrainParams) {
    const hab = this.habitat
    let ax = 0
    let ay = 0
    let az = 0

    if (b.state === 'leaving') {
      // climb and keep going, shrinking away
      ay += 6
      b.grow -= dt / 2
    } else {
      grow(b, dt)
      // the three flocking rules, from the neighbours only
      let n = 0
      let px = 0, py = 0, pz = 0
      let vx = 0, vy = 0, vz = 0
      let sx = 0, sy = 0, sz = 0
      for (const o of birds) {
        if (o === b || o.state === 'leaving') continue
        const dx = b.x - o.x
        const dy = b.y - o.y
        const dz = b.z - o.z
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 > BIRD.sight * BIRD.sight) continue
        n++
        px += o.x; py += o.y; pz += o.z
        vx += o.vx; vy += o.vy; vz += o.vz
        if (d2 < BIRD.crowd * BIRD.crowd && d2 > 1e-6) {
          sx += dx / d2; sy += dy / d2; sz += dz / d2
        }
      }
      if (n > 0) {
        ax += (vx / n - b.vx) * BIRD.align + (px / n - b.x) * BIRD.cohere + sx * BIRD.separate
        ay += (vy / n - b.vy) * BIRD.align + (py / n - b.y) * BIRD.cohere + sy * BIRD.separate
        az += (vz / n - b.vz) * BIRD.align + (pz / n - b.z) * BIRD.cohere + sz * BIRD.separate
      }

      // over paved city (or water): head back toward wild land
      const cell = hab.cellAt(b.x, b.z)
      if (hab.wild[cell]) {
        b.state = 'flock'
      } else {
        const to = hab.wayOut(b.x, b.z, true)
        if (!to) {
          b.state = 'leaving'
        } else {
          b.state = 'displaced'
          const dx = to.x - b.x
          const dz = to.z - b.z
          const d = Math.hypot(dx, dz) || 1
          ax += (dx / d) * 8
          az += (dz / d) * 8
        }
      }
      ;[ax, az] = keepInside(b.x, b.z, ax, az, 10)
    }

    // hold a height above the ground (or the water)
    const cell = hab.cellAt(b.x, b.z)
    const floor = Math.max(hab.ground[cell], params.seaLevel)
    ay += (floor + b.alt - b.y) * 1.5 - b.vy * 1.2

    b.vx += ax * dt
    b.vy += ay * dt
    b.vz += az * dt
    const sp = Math.hypot(b.vx, b.vz)
    const clamped = Math.min(BIRD.maxSpeed, Math.max(BIRD.minSpeed, sp))
    if (sp > 1e-6) {
      b.vx *= clamped / sp
      b.vz *= clamped / sp
    }
    b.vy = Math.max(-3, Math.min(3, b.vy))
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt
    b.heading = Math.atan2(b.vx, b.vz)
  }

  // --- deer ----------------------------------------------------------------------

  private stepDeer(d: Agent, deer: Agent[], foxes: Agent[], dt: number, params: TerrainParams) {
    if (d.state === 'leaving') {
      d.grow -= dt / 1.5
      return
    }
    grow(d, dt)
    d.timer -= dt

    // the nearest fox, whichever way the deer is facing
    let fox: Agent | null = null
    let fd = Infinity
    for (const f of foxes) {
      if (f.state === 'leaving') continue
      const dist = Math.hypot(f.x - d.x, f.z - d.z)
      if (dist < fd) {
        fd = dist
        fox = f
      }
    }

    if (fox && (fd < DEER.wary || (d.state === 'flee' && fd < DEER.safe))) {
      d.state = 'flee'
      d.heading = Math.atan2(d.x - fox.x, d.z - fox.z) + (this.rand() - 0.5) * 0.3
      d.speed = DEER.run
    } else if (!this.habitat.wild[this.habitat.cellAt(d.x, d.z)]) {
      if (!this.goHome(d, DEER.homeward)) return
    } else {
      if (d.state !== 'graze') {
        d.state = 'graze'
        d.timer = 0
      }
      if (d.timer <= 0) {
        // alternate between standing to graze and ambling to a new patch
        if (d.speed > 0) {
          d.speed = 0
          d.timer = 1 + this.rand() * 3
        } else {
          d.speed = DEER.walk
          d.timer = 2 + this.rand() * 3
          d.heading += (this.rand() - 0.5) * 2.4
          // drift back toward the herd if it has strayed
          const herd = centreOf(deer, d, DEER.herd)
          if (herd && Math.hypot(herd.x - d.x, herd.z - d.z) > 6) {
            d.heading = Math.atan2(herd.x - d.x, herd.z - d.z) + (this.rand() - 0.5)
          }
        }
      }
    }
    this.walk(d, dt, params)
  }

  // --- foxes ---------------------------------------------------------------------

  private stepFox(
    f: Agent,
    deer: Agent[],
    foxes: Agent[],
    dt: number,
    s: WildlifeSettings,
    params: TerrainParams,
  ) {
    if (f.state === 'leaving') {
      f.grow -= dt / 1.5
      return
    }
    grow(f, dt)
    f.timer -= dt
    f.hunger += dt / FOX.starve
    if (f.hunger >= 1) {
      f.state = 'leaving' // starved
      return
    }

    switch (f.state) {
      case 'eat':
        f.speed = 0
        if (f.timer <= 0) {
          f.state = 'rest'
          f.timer = FOX.restTime
          // a fed fox may raise a kit, if the land can hold another fox
          const alive = foxes.filter((o) => o.state !== 'leaving').length
          if (alive < this.capacity('fox', s) && this.rand() < 0.6) {
            const kit = this.spawn('fox', params, 0, f)
            kit.hunger = 0
          }
        }
        break
      case 'rest':
        f.speed = 0
        if (f.timer <= 0) this.startWander(f)
        break
      case 'hunt': {
        const p = f.prey
        const dist = p ? Math.hypot(p.x - f.x, p.z - f.z) : Infinity
        if (!p || p.state === 'leaving' || dist > FOX.giveUp || f.timer <= 0) {
          f.prey = null
          this.startWander(f) // lost it
        } else if (dist < FOX.catch) {
          p.state = 'leaving' // caught
          p.grow = Math.min(p.grow, 0.6)
          f.prey = null
          f.state = 'eat'
          f.timer = FOX.eatTime
          f.hunger = 0
          f.speed = 0
        } else {
          f.heading = Math.atan2(p.x - f.x, p.z - f.z)
          f.speed = FOX.run
        }
        break
      }
      default: {
        // wander (and displaced): look for a deer ahead, else roam
        if (!this.habitat.wild[this.habitat.cellAt(f.x, f.z)]) {
          if (!this.goHome(f, DEER.homeward)) return
          break
        }
        if (f.state !== 'wander') this.startWander(f)
        const seen = f.hunger > FOX.hungry ? this.look(f, deer) : null
        if (seen) {
          f.state = 'hunt'
          f.prey = seen
          f.timer = FOX.chaseTime
          break
        }
        if (f.timer <= 0) {
          f.heading += (this.rand() - 0.5) * 2
          f.timer = 1.5 + this.rand() * 2.5
        }
        f.speed = FOX.walk
      }
    }
    this.walk(f, dt, params)
  }

  private startWander(f: Agent) {
    f.state = 'wander'
    f.timer = 1 + this.rand() * 2
    f.speed = FOX.walk
  }

  /** The nearest deer inside the fox's cone of vision, if any. */
  private look(f: Agent, deer: Agent[]): Agent | null {
    let best: Agent | null = null
    let bd = FOX.sight
    for (const d of deer) {
      if (d.state === 'leaving') continue
      const dx = d.x - f.x
      const dz = d.z - f.z
      const dist = Math.hypot(dx, dz)
      if (dist >= bd) continue
      let off = Math.atan2(dx, dz) - f.heading
      off = Math.atan2(Math.sin(off), Math.cos(off)) // wrap to -π..π
      if (Math.abs(off) > FOX.fov / 2) continue
      best = d
      bd = dist
    }
    return best
  }

  // --- shared by the ground animals --------------------------------------------

  /** On paved ground: head for the nearest wild land, or leave if there's none. Returns false once leaving. */
  private goHome(a: Agent, speed: number): boolean {
    const to = this.habitat.wayOut(a.x, a.z, false)
    if (!to) {
      a.state = 'leaving'
      return false
    }
    a.state = 'displaced'
    a.heading = Math.atan2(to.x - a.x, to.z - a.z)
    a.speed = speed
    return true
  }

  /** Move along the heading, turning away from water and the area's edge instead of walking into them. */
  private walk(a: Agent, dt: number, params: TerrainParams) {
    if (a.speed > 0) {
      const nx = a.x + Math.sin(a.heading) * a.speed * dt
      const nz = a.z + Math.cos(a.heading) * a.speed * dt
      const inside = nx > AREA.x0 + 1 && nx < AREA.x1 - 1 && nz > AREA.z0 + 1 && nz < AREA.z1 - 1
      if (inside && this.habitat.land[this.habitat.cellAt(nx, nz)]) {
        a.x = nx
        a.z = nz
      } else {
        a.heading += Math.PI * (0.5 + this.rand())
      }
    }
    a.y = height(a.x, a.z, params)
  }

  // --- births and departures ----------------------------------------------------

  /** Keep each species near what the wild land holds: births below it, departures above it. */
  private balance(dt: number, s: WildlifeSettings, params: TerrainParams) {
    for (const sp of SPECIES) {
      const alive = this.agents.filter((a) => a.species === sp && a.state !== 'leaving')
      const cap = this.capacity(sp, s)
      const gap = cap - alive.length

      // foxes are mostly born from eating (see stepFox); newcomers only top them up to half
      const canBreed = sp !== 'fox' || alive.length < cap / 2
      if (gap > 0 && canBreed) {
        this.births[sp] += dt * Math.max(MIN_RATE[sp], gap * SHORTFALL_RATE)
        while (this.births[sp] >= 1) {
          this.births[sp] -= 1
          this.spawn(sp, params, 0)
        }
      } else {
        this.births[sp] = 0
      }

      if (gap < 0) {
        this.departures[sp] += dt * Math.max(1, -gap * 0.5)
        while (this.departures[sp] >= 1 && alive.length > 0) {
          this.departures[sp] -= 1
          // the worst-off go first: anyone stranded on paved ground
          const i = alive.findIndex((a) => a.state === 'displaced')
          const k = i >= 0 ? i : Math.floor(this.rand() * alive.length)
          alive[k].state = 'leaving'
          alive.splice(k, 1)
        }
      } else {
        this.departures[sp] = 0
      }
    }
  }

  /**
   * Add one animal: next to its parent (a fox's kit), otherwise anywhere on
   * wild land. Deer can't swim, so being born beside a parent would leave a
   * repopulated mainland empty and Roosevelt Island crowded.
   */
  private spawn(sp: Species, params: TerrainParams, grown: number, parent?: Agent): Agent {
    const hab = this.habitat
    let x = 0
    let z = 0
    let placed = false
    if (parent) {
      x = parent.x + (this.rand() - 0.5) * 4
      z = parent.z + (this.rand() - 0.5) * 4
      placed = hab.wild[hab.cellAt(x, z)] === 1
    }
    if (!placed) {
      const p = hab.randomWild(this.rand) ?? { x: 0, z: 0 }
      x = p.x
      z = p.z
    }
    const alt = BIRD.altitude[0] + this.rand() * (BIRD.altitude[1] - BIRD.altitude[0])
    const ground = height(x, z, params)
    const heading = this.rand() * Math.PI * 2
    const a: Agent = {
      id: nextId++,
      species: sp,
      state: sp === 'bird' ? 'flock' : sp === 'deer' ? 'graze' : 'wander',
      x,
      y: sp === 'bird' ? Math.max(ground, params.seaLevel) + alt : ground,
      z,
      vx: sp === 'bird' ? Math.sin(heading) * BIRD.minSpeed : 0,
      vy: 0,
      vz: sp === 'bird' ? Math.cos(heading) * BIRD.minSpeed : 0,
      heading,
      speed: 0,
      timer: this.rand() * 2,
      hunger: this.rand() * 0.5,
      grow: grown,
      alt,
      prey: null,
    }
    this.agents.push(a)
    return a
  }

  stats(s: WildlifeSettings): WildlifeStats {
    const counts: WildlifeStats['counts'] = { bird: {}, deer: {}, fox: {} }
    const totals = { bird: 0, deer: 0, fox: 0 }
    for (const a of this.agents) {
      counts[a.species][a.state] = (counts[a.species][a.state] ?? 0) + 1
      if (a.state !== 'leaving') totals[a.species]++
    }
    return {
      wildShare: this.habitat.wildShare,
      counts,
      totals,
      capacity: {
        bird: this.capacity('bird', s),
        deer: this.capacity('deer', s),
        fox: this.capacity('fox', s),
      },
    }
  }
}

/** Grow a newborn in over ~1 second. */
function grow(a: Agent, dt: number) {
  if (a.grow < 1) a.grow = Math.min(1, a.grow + dt)
}

/** Average position of the others of `group` within `radius` of `a`, or null if none. */
function centreOf(group: Agent[], a: Agent, radius: number): { x: number; z: number } | null {
  let n = 0
  let x = 0
  let z = 0
  for (const o of group) {
    if (o === a || o.state === 'leaving') continue
    if (Math.hypot(o.x - a.x, o.z - a.z) > radius) continue
    n++
    x += o.x
    z += o.z
  }
  return n > 0 ? { x: x / n, z: z / n } : null
}

/** Push back toward the middle near the area's edge. */
function keepInside(x: number, z: number, ax: number, az: number, margin: number): [number, number] {
  const push = 10
  if (x < AREA.x0 + margin) ax += push
  if (x > AREA.x1 - margin) ax -= push
  if (z < AREA.z0 + margin) az += push
  if (z > AREA.z1 - margin) az -= push
  return [ax, az]
}
