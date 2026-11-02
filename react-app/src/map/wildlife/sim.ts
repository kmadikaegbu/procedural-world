import { height, makeRng, type TerrainParams } from '../noise'
import type { Season } from '../trees/seasons'
import type { WeatherParams } from '../../weather/presets'
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
 * THE ENVIRONMENT'S RULES. The animals obey the same world the rest of the map
 * does (WildEnv, below):
 *
 *   water      thirst builds up; a thirsty animal walks (or flies) to the
 *              nearest shore, stops, faces the water and drinks
 *   land       nobody walks on water, up steep slopes (they slow on hills and
 *              turn back at cliffs) or onto paved ground; rising seas shrink the land
 *   night      deer bed down, birds roost, foxes are the ones about
 *   rain/wind  birds shelter on the ground, deer stand still, foxes see less
 *   season     birds migrate south in autumn and are fewest in winter; animals
 *              drink most in summer
 *
 * Taken from hunting-game wildlife (theHunter: Call of the Wild), where the
 * animals are the point:
 *
 *   senses     prey notice a predator by SIGHT (a wide field of view, shorter in
 *              fog, rain and dark), by SCENT (a plume drifting downwind from it)
 *              and by HEARING (a running animal is heard farther). So a fox
 *              that approaches from upwind gets smelt long before it is seen,
 *              and a clever one circles round to come in downwind
 *   alertness  what a deer senses builds an alertness meter: unaware, then
 *              alert (freezes, faces it, head up), then spooked (bolts)
 *   herds      deer live in herds with a leader; the followers keep close,
 *              copy the leader's grazing, and drink and bed down with it
 *   routines   needs and times of day: a thirsty animal goes to water, deer
 *              bed down in sheltered spots at night, in the rain, and in the
 *              midday heat, and graze at dawn and dusk
 *   tracks     animals leave prints that fade
 *
 * Movement is smoothed: an animal turns at a limited rate and speeds up and
 * slows down gradually, so it curves round obstacles and eases into a run,
 * instead of snapping to a new direction.
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
  | 'drink'
  | 'alert'
  | 'stalk'
  | 'perch'

/** The world around the animals: from the weather and the season. */
export interface WildEnv {
  /** 0 by day … 1 at night (from the sun's height). */
  night: number
  rain: number
  snow: number
  wind: number
  /** 0 … 1 around midday, when it is hot. */
  noon: number
  /** How far anything can be seen: 1 on a clear day, less in fog, rain and the dark. */
  visibility: number
  season: Season
}

export const ENV_DEFAULTS: WildEnv = {
  night: 0,
  rain: 0,
  snow: 0,
  wind: 0,
  noon: 0,
  visibility: 1,
  season: 'summer',
}

export function envFrom(w: WeatherParams, season: Season): WildEnv {
  const night = clamp01((0.12 - w.sunElevation) / 0.25)
  const rain = w.precip === 'rain' ? w.precipIntensity : 0
  return {
    night,
    rain,
    snow: w.precip === 'snow' ? w.precipIntensity : 0,
    wind: w.wind,
    noon: clamp01((w.sunElevation - 0.6) / 0.2),
    visibility: clamp01(1 - 0.6 * w.fogDensity - 0.3 * rain - 0.5 * night),
    season,
  }
}

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
  /** The heading it is turning toward, and the speed it is working up to (see walk()). */
  aim: number
  goal: number
  /** 0 = just drank … 1 = parched. */
  thirst: number
  /** How far its head is down, smoothed: 1 grazing, ~1.3 drinking, below 0 alert. */
  head: number
  /** How fast it is turning, radians per second (birds bank into it). */
  turn: number
  /** Ground animals: 0 grazing in place, 1 ambling, 2 pausing. Birds, and drinkers: on the ground / at the water. */
  mode: number
  landed: boolean
  /** Deer: how aware it is of a predator, 0 unaware … 1 spooked. */
  alert: number
  /** Deer: the herd's leader (null for a leader or a loner). */
  leader: Agent | null
  /** Deer: the bedding spot it is heading for (a habitat cell), or -1. */
  bed: number
  /** Distance walked since its last print. */
  stride: number
}

/** A footprint on the ground, fading with time. */
export interface Track {
  x: number
  y: number
  z: number
  heading: number
  /** When it was made (sim.time). */
  t: number
  species: Species
}
export const TRACK_LIFE = 45 // seconds
const MAX_TRACKS = 1600

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
  graze: 0.2, // the slow shuffle of a deer with its head down
  alert: 18, // freezes and watches a fox this close
  thirsty: 0.65,
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
  stalk: 0.7, // creeping speed when it has seen a deer
  pounce: 7, // starts the sprint once this close
  thirsty: 0.8,
}

/** How fast thirst builds, per second, before the season and rain change it. */
const THIRST: Record<Species, number> = { bird: 1 / 170, deer: 1 / 150, fox: 1 / 220 }
const DRINK_TIME = [3, 3] as const // seconds: at least, plus up to this much more

/** Senses (world units). The wind blows toward +x, and scent drifts with it. */
const SENSE = {
  deerSight: 22,
  deerFov: (260 * Math.PI) / 180, // prey eyes sit on the sides of the head
  scentBase: 10,
  scentPerWind: 8,
  scentSpread: 0.45, // the plume's width grows this much per unit downwind
  hearBase: 4,
  hearPerSpeed: 2.5,
}
const HERD_FOLLOW = 5 // a follower closer than this to its leader copies it; farther, it catches up
const HERD_SIZE = [3, 6] as const // deer per herd: at least, plus up to this many more

/** Where the wind blows: toward +x. */
const WIND_PUSH = 0.35

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
  /** The weather and season around the animals; set it every frame. */
  env: WildEnv = ENV_DEFAULTS
  /** Seconds of simulated time. */
  time = 0
  /** Fading footprints, a ring buffer. */
  tracks: Track[] = []
  private trackAt = 0
  private rand = makeRng(1609)
  private births: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }
  private departures: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }

  capacity(sp: Species, s: WildlifeSettings): number {
    const max = sp === 'bird' ? s.birds : sp === 'deer' ? s.deer : s.foxes
    // the birds migrate: most are here in spring and summer, fewest in winter
    const migration = sp === 'bird' ? { spring: 0.9, summer: 1, autumn: 0.8, winter: 0.45 }[this.env.season] : 1
    return Math.round(max * this.habitat.wildShare * migration)
  }

  /** How fast thirst builds right now: more in summer, less in the cold, much less in the rain. */
  private thirstRate(sp: Species): number {
    const season = { spring: 1, summer: 1.5, autumn: 0.9, winter: 0.6 }[this.env.season]
    return THIRST[sp] * season * (1 - 0.6 * this.env.rain)
  }

  /** Start over: every species filled to what the land holds, fully grown. */
  populate(s: WildlifeSettings, params: TerrainParams) {
    this.agents = []
    this.tracks = []
    this.trackAt = 0
    for (const sp of SPECIES) {
      const n = this.capacity(sp, s)
      if (sp === 'deer') {
        // deer come in herds: a leader, and followers born near it
        let made = 0
        while (made < n) {
          const size = Math.min(n - made, HERD_SIZE[0] + Math.floor(this.rand() * (HERD_SIZE[1] + 1)))
          const leader = this.spawn('deer', params, 1)
          for (let i = 1; i < size; i++) this.spawn('deer', params, 1, leader).leader = leader
          made += size
        }
      } else {
        for (let i = 0; i < n; i++) this.spawn(sp, params, 1)
      }
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

    this.time += dt
    this.balance(dt, s, params)
    // newborns start at size 0 too, so only the ones leaving are removed
    this.agents = this.agents.filter((a) => a.state !== 'leaving' || a.grow > 0)
  }

  // --- birds ---------------------------------------------------------------------

  private stepBird(b: Agent, birds: Agent[], dt: number, params: TerrainParams) {
    const hab = this.habitat
    const env = this.env
    let ax = 0
    let ay = 0
    let az = 0
    let alt = b.alt
    let free = true // flying: false once it is landing, perched or drinking

    b.thirst += dt * this.thirstRate('bird')

    if (b.state === 'leaving') {
      // climb and keep going, shrinking away
      ay += 6
      b.grow -= dt / 2
      b.landed = false
    } else {
      grow(b, dt)
      const cell = hab.cellAt(b.x, b.z)

      if (!hab.wild[cell]) {
        // over paved city (or water): head back toward wild land
        b.landed = false
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
      } else {
        if (b.state === 'displaced') b.state = 'flock'
        // storms and nights are spent on the ground
        const shelter = env.night > 0.65 || env.rain > 0.6 || env.wind > 3.6
        if (b.state === 'flock') {
          if (shelter) {
            b.state = 'perch'
            b.timer = 3 + this.rand() * 5
            b.landed = false
          } else if (b.thirst > 0.75 && hab.wayToWater(b.x, b.z, true)) {
            b.state = 'drink'
            b.landed = false
          }
        }

        if (b.state === 'perch') {
          free = false
          alt = 0.12
          if (!shelter && b.landed) {
            b.timer -= dt
            if (b.timer <= 0) this.takeOff(b)
          }
        } else if (b.state === 'drink') {
          const to = hab.wayToWater(b.x, b.z, true)
          if (!to) {
            b.state = 'flock'
          } else {
            const dx = to.x - b.x
            const dz = to.z - b.z
            const dist = Math.hypot(dx, dz)
            if (dist > 3 && !b.landed) {
              // fly toward the water, dropping as it nears
              ax += (dx / (dist || 1)) * 6
              az += (dz / (dist || 1)) * 6
              alt = Math.min(alt, 0.3 + dist * 0.5)
            } else {
              free = false
              alt = 0.12
              if (b.landed) {
                b.timer -= dt
                if (b.timer <= 0) {
                  b.thirst = 0
                  this.takeOff(b)
                }
              }
            }
          }
        }

        if (free) {
          // the three flocking rules, from the flying neighbours only
          let n = 0
          let px = 0, py = 0, pz = 0
          let vx = 0, vy = 0, vz = 0
          let sx = 0, sy = 0, sz = 0
          for (const o of birds) {
            if (o === b || o.state === 'leaving' || o.landed) continue
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
          // the wind pushes them downwind, and they keep a little lower in it
          ax += env.wind * WIND_PUSH
          alt = Math.max(1.5, alt - env.wind * 0.4)
        }
      }
      ;[ax, az] = keepInside(b.x, b.z, ax, az, 10)
    }

    // hold a height above the ground (or the water)
    const cell = hab.cellAt(b.x, b.z)
    const floor = Math.max(hab.ground[cell], params.seaLevel)
    ay += (floor + alt - b.y) * 1.5 - b.vy * 1.2

    b.vx += ax * dt
    b.vy += ay * dt
    b.vz += az * dt
    const sp = Math.hypot(b.vx, b.vz)
    if (free) {
      const clamped = Math.min(BIRD.maxSpeed, Math.max(BIRD.minSpeed, sp))
      if (sp > 1e-6) {
        b.vx *= clamped / sp
        b.vz *= clamped / sp
      }
    } else {
      // landing: shed speed, then stand
      const k = Math.exp(-2.4 * dt)
      b.vx *= k
      b.vz *= k
    }
    b.vy = Math.max(-3, Math.min(3, b.vy))
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.z += b.vz * dt

    if (!free && b.state !== 'leaving') {
      // on the ground once it is slow and low
      if (!b.landed && Math.hypot(b.vx, b.vz) < 0.6 && b.y - floor < 0.4) {
        b.landed = true
        if (b.state === 'drink') b.timer = DRINK_TIME[0] + this.rand() * DRINK_TIME[1]
      }
      if (b.landed) {
        b.vx = 0
        b.vy = 0
        b.vz = 0
        b.y = floor + 0.12
        // a drinker faces the water
        if (b.state === 'drink') b.heading = turnTo(b.heading, hab.waterFacing(cell), 3 * dt)
      }
    }
    // heading follows the velocity while flying (a standing bird keeps its facing)
    if (Math.hypot(b.vx, b.vz) > 0.5) {
      const h = Math.atan2(b.vx, b.vz)
      b.turn += (wrap(h - b.heading) / Math.max(dt, 1e-3) - b.turn) * Math.min(1, dt * 5)
      b.heading = h
    } else {
      b.turn *= 0.9
    }
  }

  private takeOff(b: Agent) {
    b.state = 'flock'
    b.landed = false
    const h = this.rand() * Math.PI * 2
    b.vx = Math.sin(h) * BIRD.minSpeed
    b.vz = Math.cos(h) * BIRD.minSpeed
    b.vy = 2.5
  }

  // --- senses --------------------------------------------------------------------

  /** Is `to` inside the scent plume drifting downwind (toward +x) from `from`? */
  private scented(from: { x: number; z: number }, to: { x: number; z: number }): number {
    const range = (SENSE.scentBase + SENSE.scentPerWind * this.env.wind) * (1 - 0.5 * this.env.rain)
    const dx = to.x - from.x
    if (dx <= 0 || dx > range) return 0
    if (Math.abs(to.z - from.z) > dx * SENSE.scentSpread + 1.5) return 0
    return 1 - dx / range // strongest right beside the source
  }

  /** How strongly a deer notices a fox, 0..1, by sight, scent and hearing. */
  private senseFox(d: Agent, f: Agent): number {
    const env = this.env
    const dist = Math.hypot(f.x - d.x, f.z - d.z)
    let s = 0
    // sight: a very wide field of view, shorter in fog, rain and the dark; a creeping fox is harder to see
    const range = SENSE.deerSight * env.visibility * (f.state === 'stalk' ? 0.6 : 1)
    if (dist < range) {
      const off = Math.abs(wrap(Math.atan2(f.x - d.x, f.z - d.z) - d.heading))
      if (off < SENSE.deerFov / 2) s = Math.max(s, 1 - dist / range)
    }
    // scent: the fox's smell reaches a deer that is downwind of it
    const smell = this.scented(f, d)
    if (smell > 0) s = Math.max(s, 0.5 + 0.5 * smell)
    // hearing: a running fox is heard from farther, the rain masks it
    const hear = (SENSE.hearBase + f.speed * SENSE.hearPerSpeed) * (1 - 0.5 * env.rain)
    if (dist < hear) s = Math.max(s, 0.6)
    return s
  }

  // --- deer ----------------------------------------------------------------------

  private stepDeer(d: Agent, deer: Agent[], foxes: Agent[], dt: number, params: TerrainParams) {
    if (d.state === 'leaving') {
      d.grow -= dt / 1.5
      return
    }
    const hab = this.habitat
    const env = this.env
    grow(d, dt)
    d.timer -= dt
    d.thirst += dt * this.thirstRate('deer')
    let headTarget = 0
    const lead = d.leader && d.leader.state !== 'leaving' ? d.leader : null
    if (d.leader && !lead) d.leader = null

    // what it senses: the strongest cue from any fox builds the alertness meter
    let src: Agent | null = null
    let stim = 0
    for (const f of foxes) {
      if (f.state === 'leaving') continue
      const s = this.senseFox(d, f)
      if (s > stim) {
        stim = s
        src = f
      }
    }
    d.alert = clamp01(d.alert + (stim > 0 ? stim * dt * 1.6 : -dt * 0.2))
    if (lead) d.alert = Math.max(d.alert, lead.alert * 0.9) // the herd takes its alarm from the leader
    const srcDist = src ? Math.hypot(src.x - d.x, src.z - d.z) : Infinity

    // a herd bolts together: a deer sees its neighbour run and runs too
    let panic: Agent | null = null
    for (const o of deer) {
      if (o !== d && o.state === 'flee' && Math.hypot(o.x - d.x, o.z - d.z) < 9) panic = o
    }

    const spooked =
      d.alert > 0.8 || srcDist < DEER.wary || (d.state === 'flee' && (srcDist < DEER.safe || d.alert > 0.35))
    if (spooked) {
      d.state = 'flee'
      d.landed = false
      d.aim = src ? Math.atan2(d.x - src.x, d.z - src.z) + (this.rand() - 0.5) * 0.3 : d.heading
      d.goal = DEER.run
    } else if (panic && d.state !== 'flee') {
      d.state = 'flee'
      d.landed = false
      d.aim = panic.heading + (this.rand() - 0.5) * 0.5
      d.goal = DEER.run * 0.9
    } else if (!hab.wild[hab.cellAt(d.x, d.z)]) {
      d.landed = false
      if (!this.goHome(d, DEER.homeward)) return
    } else if (d.alert > 0.3) {
      // something is there: freeze, head up, face it (or into the wind if it's only a smell)
      d.state = 'alert'
      d.landed = false
      d.aim =
        src && srcDist < SENSE.deerSight ? Math.atan2(src.x - d.x, src.z - d.z) : -Math.PI / 2
      d.goal = 0
      headTarget = -0.25
    } else {
      if (d.state === 'flee' || d.state === 'alert' || d.state === 'displaced') {
        d.state = 'graze'
        d.timer = 0
      }
      // the herd's needs follow its leader's
      if (lead && lead.state === 'drink') d.thirst = Math.max(d.thirst, 0.7)
      const heat = env.noon > 0.7 && (env.season === 'summer' || env.season === 'spring')
      const sleepy =
        env.night > 0.65 || env.rain > 0.65 || heat || (lead !== null && lead.state === 'rest')
      if (sleepy && d.thirst < 0.9) {
        headTarget = this.goBed(d, lead)
      } else if (d.thirst > DEER.thirsty || (d.state === 'drink' && d.thirst > 0)) {
        headTarget = this.goDrink(d, DEER.walk * 1.6)
      } else {
        if (d.state !== 'graze') {
          d.state = 'graze'
          d.timer = 0
          d.landed = false
        }
        if (d.timer <= 0) this.pickGrazing(d, deer, lead)
        // don't walk through a neighbour
        for (const o of deer) {
          if (o === d || o.state === 'leaving') continue
          const dx = d.x - o.x
          const dz = d.z - o.z
          if (dx * dx + dz * dz < 2.2 * 2.2) {
            d.aim = Math.atan2(dx, dz)
            if (d.goal === 0) d.goal = DEER.graze
            break
          }
        }
        headTarget = d.mode === 0 ? 0.9 : 0
      }
    }
    this.walk(d, dt, params)
    d.head += (headTarget - d.head) * Math.min(1, dt * 3)
  }

  /** Choose the next bout of grazing: shuffle along head down, amble to a new patch, or stand and look around. */
  private pickGrazing(d: Agent, deer: Agent[], lead: Agent | null) {
    const env = this.env
    const gait = [DEER.graze, DEER.walk * (1 - 0.4 * env.snow), 0]
    if (lead && Math.hypot(lead.x - d.x, lead.z - d.z) > HERD_FOLLOW) {
      // fallen behind: catch up with the leader
      d.mode = 1
      d.goal = DEER.walk * 1.3
      d.aim = Math.atan2(lead.x - d.x, lead.z - d.z)
      d.timer = 1
      return
    }
    if (lead) {
      // close to the leader: do what it does, in the same direction
      d.mode = lead.mode
      d.goal = gait[d.mode]
      d.aim = lead.aim + (this.rand() - 0.5) * 0.5
      d.timer = 1 + this.rand() * 2
      return
    }
    // a leader (or a loner) decides for the herd; dawn and dusk are the busiest feeding times
    const r = this.rand()
    if (r < 0.55) {
      d.mode = 0
      d.timer = 3 + this.rand() * 5
      d.aim += (this.rand() - 0.5) * 0.8
    } else if (r < 0.82) {
      d.mode = 1
      d.timer = 2 + this.rand() * 3
      d.aim += (this.rand() - 0.5) * 2.4
      // a loner drifts back toward other deer if it has strayed
      const herd = centreOf(deer, d, DEER.herd)
      if (herd && Math.hypot(herd.x - d.x, herd.z - d.z) > 6) {
        d.aim = Math.atan2(herd.x - d.x, herd.z - d.z) + (this.rand() - 0.5)
      }
    } else {
      d.mode = 2
      d.timer = 1 + this.rand() * 2
    }
    d.goal = gait[d.mode]
  }

  /**
   * Bedding down: walk to a sheltered spot (a leader picks the nearest; the
   * herd goes where its leader is), then stand still, head up. Returns the head.
   */
  private goBed(d: Agent, lead: Agent | null): number {
    const hab = this.habitat
    if (d.state !== 'rest') {
      d.state = 'rest'
      d.landed = false
      d.bed = lead ? lead.bed : hab.nearestBed(d.x, d.z)
    }
    // followers gather round their leader; a leader goes to its bed
    let tx: number
    let tz: number
    if (lead) {
      tx = lead.x
      tz = lead.z
    } else if (d.bed >= 0) {
      const c = hab.centre(d.bed)
      tx = c.x
      tz = c.z
    } else {
      d.goal = 0
      return 0
    }
    const dist = Math.hypot(tx - d.x, tz - d.z)
    if (dist > (lead ? 2.5 : 1.5)) {
      d.aim = Math.atan2(tx - d.x, tz - d.z)
      d.goal = DEER.walk * 1.2
    } else {
      d.goal = 0
    }
    return 0
  }

  /**
   * Thirsty: walk to the nearest shore, stand facing the water and drink, then
   * carry on. Returns how far the head should be down. With no reachable water
   * the animal just carries on with its day.
   */
  private goDrink(a: Agent, speed: number): number {
    const hab = this.habitat
    const cell = hab.cellAt(a.x, a.z)
    a.state = 'drink'
    if (a.landed) {
      // drinking
      a.goal = 0
      a.aim = hab.waterFacing(cell)
      if (a.timer <= 0) {
        a.thirst = 0
        a.landed = false
        a.state = a.species === 'fox' ? 'wander' : 'graze'
        a.timer = 0
      }
      return 1.3
    }
    if (hab.shore[cell]) {
      a.goal = 0
      if (a.speed < 0.4) {
        a.landed = true
        a.timer = DRINK_TIME[0] + this.rand() * DRINK_TIME[1]
      }
      return 0
    }
    const to = hab.wayToWater(a.x, a.z, false)
    if (!to) {
      a.thirst = Math.min(a.thirst, 0.6) // no water it can reach: it goes without
      a.state = a.species === 'fox' ? 'wander' : 'graze'
      return 0
    }
    a.aim = Math.atan2(to.x - a.x, to.z - a.z)
    a.goal = speed
    return 0
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
    const env = this.env
    grow(f, dt)
    f.timer -= dt
    f.hunger += dt / FOX.starve
    f.thirst += dt * this.thirstRate('fox')
    if (f.hunger >= 1) {
      f.state = 'leaving' // starved
      return
    }
    let headTarget = 0
    // foxes work the night: hungry sooner and sharper-eyed in the dark, blind in the rain and snow
    const hungry = FOX.hungry * (1 - 0.5 * env.night)
    const sight = FOX.sight * (1 + 0.2 * env.night) * (1 - 0.35 * Math.min(1, env.rain + env.snow))

    switch (f.state) {
      case 'eat':
        f.goal = 0
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
        headTarget = 1 // head down at the kill
        break
      case 'rest':
        f.goal = 0
        if (f.timer <= 0) this.startWander(f)
        break
      case 'stalk': {
        const p = f.prey
        const dist = p ? Math.hypot(p.x - f.x, p.z - f.z) : Infinity
        if (!p || p.state === 'leaving' || dist > sight * 1.3 || f.timer <= 0) {
          f.prey = null
          this.startWander(f)
        } else if (dist < FOX.pounce || p.state === 'flee') {
          f.state = 'hunt'
          f.timer = FOX.chaseTime
        } else {
          // creep up, low to the ground, coming in from downwind so the deer can't smell it
          const around = this.env.wind > 0.3 && dist > FOX.pounce + 3 && f.x < p.x + 2
          f.aim = Math.atan2(p.x + (around ? 7 : 0) - f.x, p.z - f.z)
          f.goal = FOX.stalk
          headTarget = 0.6
        }
        break
      }
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
          f.goal = 0
        } else {
          f.aim = Math.atan2(p.x - f.x, p.z - f.z)
          f.goal = FOX.run
        }
        break
      }
      default: {
        // wander (and displaced, drinking): look for a deer ahead, else roam
        if (!this.habitat.wild[this.habitat.cellAt(f.x, f.z)]) {
          f.landed = false
          if (!this.goHome(f, DEER.homeward)) return
          break
        }
        if (f.state === 'displaced') this.startWander(f)
        if (f.state === 'drink' || f.thirst > FOX.thirsty) {
          headTarget = this.goDrink(f, FOX.walk * 1.4)
          break
        }
        if (f.state !== 'wander') this.startWander(f)
        const seen = f.hunger > hungry ? this.look(f, deer, sight) : null
        if (seen) {
          f.prey = seen
          f.timer = FOX.chaseTime
          const close = Math.hypot(seen.x - f.x, seen.z - f.z) < FOX.pounce
          f.state = close ? 'hunt' : 'stalk'
          break
        }
        if (f.timer <= 0) {
          // by day a fed fox often lies up; at night it roams
          if (env.night < 0.3 && f.hunger < 0.4 && this.rand() < 0.3) {
            f.state = 'rest'
            f.timer = 3 + this.rand() * 4
            f.goal = 0
            break
          }
          f.aim += (this.rand() - 0.5) * 2
          f.timer = 1.5 + this.rand() * 2.5
        }
        f.goal = FOX.walk * (1 - 0.3 * env.snow)
      }
    }
    this.walk(f, dt, params)
    f.head += (headTarget - f.head) * Math.min(1, dt * 3)
  }

  private startWander(f: Agent) {
    f.state = 'wander'
    f.landed = false
    f.timer = 1 + this.rand() * 2
    f.goal = FOX.walk
  }

  /** The nearest deer inside the fox's cone of vision, if any. */
  private look(f: Agent, deer: Agent[], sight: number): Agent | null {
    let best: Agent | null = null
    let bd = sight
    for (const d of deer) {
      if (d.state === 'leaving') continue
      const dx = d.x - f.x
      const dz = d.z - f.z
      const dist = Math.hypot(dx, dz)
      if (dist >= bd) continue
      let off = Math.atan2(dx, dz) - f.heading
      off = Math.atan2(Math.sin(off), Math.cos(off)) // wrap to -π..π
      // out of its field of view, a fox can still smell a deer that is upwind of it
      if (Math.abs(off) > FOX.fov / 2 && this.scented(d, f) === 0) continue
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
    a.aim = Math.atan2(to.x - a.x, to.z - a.z)
    a.goal = speed
    return true
  }

  /**
   * Move an animal one step. It doesn't snap to its new heading or speed: it
   * turns at a limited rate (faster when running), eases up to speed and eases
   * off again, slows on steep ground and in sharp turns, and stops for water,
   * cliffs and the edge of the area instead of walking into them.
   */
  private walk(a: Agent, dt: number, params: TerrainParams) {
    const hab = this.habitat
    const diff = wrap(a.aim - a.heading)
    const rate = a.state === 'flee' || a.state === 'hunt' ? 4.5 : a.species === 'deer' ? 2.2 : 3
    const turn = Math.max(-rate * dt, Math.min(rate * dt, diff))
    a.heading += turn
    a.turn += (turn / Math.max(dt, 1e-3) - a.turn) * Math.min(1, dt * 6)

    const slope = hab.slope[hab.cellAt(a.x, a.z)]
    const uphill = 1 - 0.55 * clamp01((slope - 0.25) / 0.8)
    const bend = 1 - 0.7 * clamp01(Math.abs(diff) / 1.6)
    const target = a.goal * uphill * bend
    const accel = target > a.speed ? 2.5 : 7
    a.speed += Math.max(-accel * dt, Math.min(accel * dt, target - a.speed))
    if (a.goal === 0 && a.speed < 0.02) a.speed = 0

    if (a.speed > 0) {
      const nx = a.x + Math.sin(a.heading) * a.speed * dt
      const nz = a.z + Math.cos(a.heading) * a.speed * dt
      const inside = nx > AREA.x0 + 1 && nx < AREA.x1 - 1 && nz > AREA.z0 + 1 && nz < AREA.z1 - 1
      const next = hab.cellAt(nx, nz)
      if (inside && hab.land[next] && hab.slope[next] < STEEP) {
        a.x = nx
        a.z = nz
      } else {
        // water, a cliff or the edge: turn away and slow down
        a.aim = a.heading + Math.PI * (0.5 + this.rand())
        a.speed *= 0.4
      }
    }
    a.y = height(a.x, a.z, params)

    // a print every stride, left and right alternately
    if (a.speed > 0.05 && a.species !== 'bird') {
      a.stride += a.speed * dt
      const gap = a.species === 'deer' ? 0.9 : 0.55
      if (a.stride > gap) {
        a.stride -= gap
        const side = (Math.floor(this.time / 0.4) % 2 ? 1 : -1) * 0.12
        const print: Track = {
          x: a.x + Math.cos(a.heading) * side,
          y: a.y,
          z: a.z - Math.sin(a.heading) * side,
          heading: a.heading,
          t: this.time,
          species: a.species,
        }
        if (this.tracks.length < MAX_TRACKS) this.tracks.push(print)
        else {
          this.tracks[this.trackAt] = print
          this.trackAt = (this.trackAt + 1) % MAX_TRACKS
        }
      }
    }
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
          const born = this.spawn(sp, params, 0)
          if (sp === 'deer') {
            // a newborn joins the nearest herd, if there is one close by
            const kin = alive.find((o) => o !== born && Math.hypot(o.x - born.x, o.z - born.z) < 12)
            if (kin) born.leader = kin.leader ?? kin
          }
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
      aim: heading,
      goal: 0,
      thirst: this.rand() * 0.5,
      head: 0,
      turn: 0,
      mode: 0,
      landed: false,
      alert: 0,
      leader: null,
      bed: -1,
      stride: 0,
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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Slope (rise over run) above which an animal on foot won't go: a cliff. */
const STEEP = 1.3

/** An angle wrapped to -π..π. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/** Turn `from` toward `to` by at most `max` radians. */
function turnTo(from: number, to: number, max: number): number {
  const d = wrap(to - from)
  return from + Math.max(-max, Math.min(max, d))
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
