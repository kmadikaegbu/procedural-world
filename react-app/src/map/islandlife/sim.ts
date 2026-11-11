import { islandEdges } from '../world/island'
import { isOpen, LINES, mainStreetU, PLACES, placeIndex, TOWN_OPENS, type Place } from './places'
import { streetDrive, streetWalk } from './streets'

/**
 * ISLAND LIFE: Roosevelt Island run as a small city simulation, after Stone
 * Librande's diagrams of SimCity (Class 09). His four parts, as they are here:
 *
 *   UNITS      homes, workplaces, the school, shops, parks, three stations and
 *              the trash plant (places.ts)
 *   AGENTS     people, each one standing for ten, on a daily schedule set by
 *              who they are: commuters, local workers, children, retirees,
 *              Cornell Tech students, and people who come in for the day
 *              (hospital staff on three shifts, campus staff, teachers, visitors)
 *   PATHS      the island's real streets and footpaths (streets.ts), which
 *              every walk follows (on the pavements) and every vehicle drives
 *              (on the right); the Tram, the subway and
 *              the bus, which run on a timetable and carry a limited number a
 *              trip, so queues build at the rush hours; the Roosevelt Island
 *              Bridge, the only road on and off; and the AVAC tubes under
 *              Main Street, which suck each building's trash to the plant
 *   VEHICLES   the bus to Queens, which pulls in at Motorgate for each trip of
 *              the timetable; the island's red bus, up and down Main Street;
 *              and cars that come over the bridge to drop someone off or make
 *              a delivery, more of them at the rush hours
 *   RESOURCES  people (where they are), trash (made at home and in the
 *              hospitals, carried by the tubes) and electricity (what each
 *              unit draws for the people in it)
 *
 * Time runs in simulated minutes from midnight of day 0. It is a weekday
 * every day. The rates are stylized: they give the right shape of a day,
 * not measured figures (see the History and Design Position note).
 */

/** Real people each agent stands for. */
export const PER_AGENT = 10

/** Walking speed: 1.3 m/s, in world units (33.5 m) per simulated minute. */
const WALK = (1.3 * 60) / 33.5
/**
 * How fast the trash moves in the tubes, units per minute. The real system blows
 * it along at about 100 km/h, which would cross the island in about a simulated
 * minute: a blink at any useful speed. It is drawn at a tenth of that, so you
 * can watch a load travel to the plant.
 */
const TUBE = 1600 / 33.5 / 10
/** Minutes between the plant's collection cycles. */
const AVAC_CYCLE = 10
/** The plant only opens a chute holding at least this much (kg). */
const AVAC_MIN = 5
/** Trash a person makes each minute they're home and awake, kg (about 1 kg a day). */
const HOME_TRASH = 0.002
/** Trash a hospital makes each minute for each person on its staff roll, kg. */
const HOSPITAL_TRASH = 0.0015

/** Driving speed on Main Street: about 25 km/h, in units per simulated minute (the buses a little slower). */
const DRIVE = 25000 / 60 / 33.5
const BUS_DRIVE = 20000 / 60 / 33.5
/** How far right of Main Street's middle vehicles drive, and how far out the sidewalks are (units). */
const DRIVE_LANE = 0.09
const SIDEWALK = 0.2
/** Minutes between the red buses, at the rush hours and otherwise. */
const RED_BUS = { peak: 8, offPeak: 16 }
/**
 * Cars coming over the bridge each simulated minute, through the day (each a
 * real car). Roosevelt Island keeps most cars off its streets: visitors park in
 * Motorgate, so the cars on Main Street are mostly drop-offs, taxis and
 * deliveries. Stylized, like the other rates.
 */
function carsPerMinute(m: number): number {
  if (m < 360) return 0.05
  if (m < 420) return 0.3
  if (rush(m)) return 0.9
  if (m < 1200) return 0.5
  return 0.2
}

const DAY = 1440
const OFF = -1

export type Role = 'commuter' | 'worker' | 'child' | 'retiree' | 'student' | 'staff' | 'campus' | 'teacher' | 'visitor'
export type Doing = 'in' | 'walk' | 'park' | 'queue' | 'away' | 'inbound'

export const ROLES: Role[] = ['commuter', 'worker', 'child', 'retiree', 'student', 'staff', 'campus', 'teacher', 'visitor']

/** A stop on a person's day: at this time, head here (OFF = off the island); `then` stays a while and moves on. */
interface Stop {
  at: number
  place: number
  then?: { stay: number; place: number }
}

export interface Person {
  role: Role
  /** Their home place, or OFF for people who live off the island. */
  home: number
  /** Which line (LINES) they use to leave and come back. */
  line: number
  plan: Stop[]
  /** The next stop in the plan, and the absolute minute it starts. */
  next: number
  nextAt: number
  /** A short stay in progress (a shop on the way home): when it ends, and where to go then. */
  thenAt: number
  thenPlace: number
  pendingThen: Stop['then'] | null
  doing: Doing
  /** Where they're heading, or are (a place index, or OFF). */
  target: number
  /** Position, island frame. */
  s: number
  u: number
  route: [number, number][]
  leg: number
  speed: number
  /** Their side of Main Street, so a crowd doesn't walk in single file. */
  lane: number
  pause: number
  seed: number
}

interface LineState {
  outQ: Person[]
  inQ: Person[]
  nextAt: number
  ridersToday: number
  ridersYesterday: number
  /** The trip a bus has already been sent for (the bus line only). */
  busFor: number
}

export type VehicleKind = 'bus' | 'redbus' | 'car'

/** One part of a vehicle's run: drive this route, then wait `dwell` minutes (and at least until `until`). */
interface Drive {
  route: [number, number][]
  dwell: number
  until?: number
}

export interface Vehicle {
  kind: VehicleKind
  seed: number
  /** Position, island frame, and the way it faces (a unit vector, island frame). */
  s: number
  u: number
  ds: number
  du: number
  speed: number
  drives: Drive[]
  part: number
  route: [number, number][]
  leg: number
  /** Parked (at a stop or a door) until this minute. */
  waitUntil: number
}

interface Pulse {
  route: [number, number][]
  leg: number
  s: number
  u: number
  kg: number
}

export interface IslandLifeStats {
  open: boolean
  minute: number
  day: number
  /** People (not agents) on the island, and off it among those the island counts. */
  onIsland: number
  offIsland: number
  doing: Record<Doing, number>
  roles: Record<Role, number>
  lines: { short: string; open: boolean; waiting: number; arriving: number; ridersToday: number; ridersYesterday: number }[]
  trash: { inChutes: number; collectedToday: number; collectedYesterday: number }
  /** Electricity the island draws now, MW, and every 10 minutes today and yesterday. */
  powerMW: number
  today: number[]
  yesterday: number[]
  shopVisits: number
  /** Vehicles on the island's streets now. */
  cars: number
  buses: number
}

/** A small seeded random generator (mulberry32), so a year's population is always the same. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mod = (m: number) => ((m % DAY) + DAY) % DAY
const rush = (m: number) => (m >= 420 && m < 600) || (m >= 960 && m < 1200)
const awake = (m: number) => m >= 420 && m < 1380

function lineRuns(i: number, m: number) {
  const l = LINES[i]
  return (m >= l.from && m < l.to) || (l.to > DAY && m < l.to - DAY)
}

let active: IslandLifeSim | null = null
/** The island simulation that's running now, for the panel's clock buttons. */
export const activeIslandSim = () => active
export const setActiveIslandSim = (s: IslandLifeSim | null) => {
  active = s
}

export class IslandLifeSim {
  /** Absolute simulated minutes. Starts at 7:00 on day 0, as the morning rush begins. */
  clock = 7 * 60
  people: Person[] = []
  pulses: Pulse[] = []
  vehicles: Vehicle[] = []
  year = 0
  private key = ''
  private open: boolean[] = PLACES.map(() => false)
  private lines: LineState[] = LINES.map(() => ({ outQ: [], inQ: [], nextAt: 0, ridersToday: 0, ridersYesterday: 0, busFor: -1 }))
  private nextRedBus = 0
  private carsDue = 0
  private vehicleSeed = 0
  private chutes = new Float64Array(PLACES.length)
  private present = new Int32Array(PLACES.length)
  private nextCycle = 0
  private collectedToday = 0
  private collectedYesterday = 0
  private shopVisits = 0
  private today: number[] = []
  private yesterday: number[] = []
  private power = 0

  get minute() {
    return mod(this.clock)
  }
  get day() {
    return Math.floor(this.clock / DAY)
  }
  get running() {
    return this.year >= TOWN_OPENS
  }
  isOpen(i: number) {
    return this.open[i]
  }
  lineOpen(i: number) {
    return this.year >= LINES[i].open && this.open[LINES[i].place]
  }

  /** Set the year: rebuilds the population when the island's places change. */
  setYear(year: number) {
    const y = Math.floor(year)
    if (y === this.year) return
    this.year = y
    this.open = PLACES.map((p) => isOpen(p, y))
    const key = `${y >= TOWN_OPENS}|${this.open.map((o) => (o ? 1 : 0)).join('')}|${LINES.map((_, i) => (this.lineOpen(i) ? 1 : 0)).join('')}`
    if (key === this.key) return
    this.key = key
    this.populate()
  }

  /** Jump the clock to a time of day (today), and put everyone where their day has them then. */
  setTime(minuteOfDay: number) {
    this.clock = this.day * DAY + mod(minuteOfDay)
    this.settle()
  }

  // --- the population --------------------------------------------------------------

  private populate() {
    this.people = []
    this.pulses = []
    this.chutes.fill(0)
    if (!this.running) {
      this.settle()
      return
    }
    const open = (name: string) => {
      const i = placeIndex(name)
      return i >= 0 && this.open[i] ? i : OFF
    }
    const parks = PLACES.map((p, i) => (p.kind === 'park' && this.open[i] ? i : OFF)).filter((i) => i !== OFF)
    const shop = open('Main Street shops')
    const school = open('Roosevelt Island school')
    const campus = open('Cornell Tech: Bloomberg Center')
    const freedoms = open('Four Freedoms Park')
    const field = open('Capobianco Field')
    const workplaces = PLACES.map((_, i) => i).filter(
      (i) => this.open[i] && ['shop', 'school', 'hospital', 'campus'].includes(PLACES[i].kind),
    )
    const lineWeights = LINES.map((l, i) => (this.lineOpen(i) ? l.weight : 0))

    let n = 0
    const add = (role: Role, home: number, build: (r: () => number) => Stop[], preferTram = false) => {
      const seed = n++ * 7919 + 13
      const r = rng(seed)
      const line = pickLine(lineWeights, r(), preferTram)
      this.people.push({
        role,
        home,
        line,
        plan: build(r).map((s) => ({ ...s, at: mod(s.at) })).sort((a, b) => a.at - b.at),
        next: 0,
        nextAt: 0,
        thenAt: -1,
        thenPlace: OFF,
        pendingThen: null,
        doing: 'in',
        target: home,
        s: 0,
        u: 0,
        route: [],
        leg: 0,
        speed: WALK * (0.85 + 0.3 * r()),
        lane: (r() < 0.5 ? -1 : 1) * (SIDEWALK + 0.07 * r()),
        pause: 0,
        seed,
      })
    }
    const pick = (list: number[], x: number) => list[Math.min(list.length - 1, Math.floor(x * list.length))]
    const shopThen = (stay: number, then: number) => (shop !== OFF ? { place: shop, then: { stay, place: then } } : { place: then })

    // residents
    PLACES.forEach((p, home) => {
      if (p.kind !== 'home' || !this.open[home]) return
      const agents = Math.round(p.people / PER_AGENT)
      for (let k = 0; k < agents; k++) {
        const r = rng(home * 1000 + k)
        const x = r()
        if (p.name === 'Cornell Tech: The House') {
          add('student', home, (q) => {
            const go = 540 + 90 * q()
            return [
              { at: go, place: campus === OFF ? OFF : campus },
              { at: 750 + 30 * q(), ...shopThen(40, campus === OFF ? home : campus) },
              { at: 1080 + 300 * q(), place: home },
            ]
          })
        } else if (x < 0.14) {
          add('child', home, (q) =>
            school !== OFF
              ? [
                  { at: 460 + 30 * q(), place: school },
                  { at: 900 + 10 * q(), place: q() < 0.6 && field !== OFF ? field : home },
                  { at: 1020 + 90 * q(), place: home },
                ]
              : [
                  { at: 440 + 30 * q(), place: OFF },
                  { at: 930 + 60 * q(), place: home },
                ],
          )
        } else if (x < 0.32) {
          add('retiree', home, (q) => [
            { at: 570 + 90 * q(), place: parks.length ? pick(parks, q()) : home },
            { at: 720 + 60 * q(), place: home },
            { at: 930 + 90 * q(), ...shopThen(25, home) },
          ])
        } else if (x < 0.4 && workplaces.length) {
          add('worker', home, (q) => {
            const work = pick(workplaces, q())
            const start = 480 + 60 * q()
            return [
              { at: start, place: work },
              { at: start + 510, ...(q() < 0.3 ? shopThen(15, home) : { place: home }) },
            ]
          })
        } else {
          add('commuter', home, (q) => {
            const leave = 420 + 120 * q()
            const back = leave + 540 + 60 * (q() - 0.5)
            return [
              { at: leave, place: OFF },
              { at: back, ...(q() < 0.35 ? shopThen(15 + 15 * q(), home) : { place: home }) },
            ]
          })
        }
      }
    })

    // people who come in for the day
    PLACES.forEach((p, i) => {
      if (!this.open[i]) return
      const agents = Math.round(p.people / PER_AGENT)
      if (p.kind === 'hospital') {
        // three shifts: half on days, three in ten on evenings, two in ten on nights
        for (let k = 0; k < agents; k++) {
          const f = k / agents
          const start = f < 0.5 ? 420 : f < 0.8 ? 900 : 1380
          add('staff', OFF, (q) => [
            { at: start - 35 - 20 * q(), place: i },
            { at: start + 480 + 5 * q(), place: OFF },
          ])
        }
      } else if (p.kind === 'campus') {
        for (let k = 0; k < agents; k++)
          add('campus', OFF, (q) => [
            { at: 495 + 90 * q(), place: i },
            { at: 1020 + 120 * q(), place: OFF },
          ])
      } else if (p.kind === 'school') {
        for (let k = 0; k < 4; k++)
          add('teacher', OFF, (q) => [
            { at: 435 + 20 * q(), place: i },
            { at: 945 + 30 * q(), place: OFF },
          ])
      }
    })
    // day trippers who ride the Tram out to the Four Freedoms memorial
    if (freedoms !== OFF)
      for (let k = 0; k < 30; k++)
        add(
          'visitor',
          OFF,
          (q) => {
            const come = 630 + 240 * q()
            return [
              { at: come, place: freedoms },
              { at: come + 150 + 60 * q(), place: OFF },
            ]
          },
          true,
        )

    this.settle()
  }

  /** Put everyone where their plan has them at the current time, with no one walking or waiting. */
  private settle() {
    const now = this.minute
    for (const l of this.lines) {
      l.outQ = []
      l.inQ = []
    }
    for (const p of this.people) {
      let cur = p.plan.length - 1
      for (let k = 0; k < p.plan.length; k++) if (p.plan[k].at <= now) cur = k
      const stop = p.plan[cur]
      const place = stop.then ? stop.then.place : stop.place
      p.route = []
      p.thenAt = -1
      p.pendingThen = null
      p.target = place
      if (place === OFF) {
        p.doing = 'away'
      } else {
        const pl = PLACES[place]
        if (pl.kind === 'park') {
          p.doing = 'park'
          ;[p.s, p.u] = parkPoint(pl, rng(p.seed + this.clock)())
        } else {
          p.doing = 'in'
          ;[p.s, p.u] = pl.door
        }
      }
      p.next = (cur + 1) % p.plan.length
      p.nextAt = this.dayBase() + p.plan[p.next].at
      if (p.nextAt <= this.clock) p.nextAt += DAY
    }
    LINES.forEach((_, i) => {
      this.lines[i].nextAt = this.nextTrip(i, this.clock)
      this.lines[i].busFor = -1
    })
    this.nextCycle = this.clock + AVAC_CYCLE
    this.pulses = []
    this.vehicles = []
    this.nextRedBus = this.clock
    this.carsDue = 0
  }

  private dayBase() {
    return this.day * DAY
  }

  // --- moving about ----------------------------------------------------------------

  /** Send a person toward a place (or off the island). */
  private head(p: Person, target: number) {
    p.target = target
    if (target === OFF) {
      if (p.doing === 'away') return
      if (p.doing === 'inbound') {
        drop(this.lines[p.line].inQ, p)
        p.doing = 'away'
        return
      }
      if (p.doing === 'queue') return
      this.walkTo(p, PLACES[LINES[p.line].place].door)
      return
    }
    if (p.doing === 'away') {
      p.doing = 'inbound'
      this.lines[p.line].inQ.push(p)
      return
    }
    if (p.doing === 'inbound') return
    if (p.doing === 'queue') drop(this.lines[p.line].outQ, p)
    const pl = PLACES[target]
    this.walkTo(p, pl.kind === 'park' ? parkPoint(pl, rng(p.seed + Math.floor(this.clock))()) : pl.door)
  }

  private walkTo(p: Person, to: [number, number]) {
    p.route = walk([p.s, p.u], to, p.lane)
    p.leg = 1
    p.doing = 'walk'
  }

  private arrive(p: Person) {
    p.route = []
    if (p.target === OFF) {
      p.doing = 'queue'
      this.lines[p.line].outQ.push(p)
      return
    }
    const pl = PLACES[p.target]
    p.doing = pl.kind === 'park' ? 'park' : 'in'
    p.pause = 2 + 6 * Math.random()
    if (pl.kind === 'shop') this.shopVisits += PER_AGENT
    if (p.pendingThen) {
      p.thenAt = this.clock + p.pendingThen.stay
      p.thenPlace = p.pendingThen.place
      p.pendingThen = null
    }
  }

  // --- the timetable ---------------------------------------------------------------

  private nextTrip(i: number, after: number) {
    let t = after
    for (let k = 0; k < 400; k++) {
      const m = mod(t)
      if (lineRuns(i, m)) return t + (rush(m) ? LINES[i].peak : LINES[i].offPeak)
      t += 5
    }
    return after + DAY
  }

  /** A trip leaves the island and another arrives: each takes up to the line's capacity from its queue. */
  private trip(i: number) {
    const l = this.lines[i]
    const cap = Math.max(1, Math.ceil(LINES[i].cap / PER_AGENT))
    const leaving = l.outQ.splice(0, cap)
    for (const p of leaving) p.doing = 'away'
    const coming = l.inQ.splice(0, cap)
    const door = PLACES[LINES[i].place].door
    for (const p of coming) {
      // step off at the station and walk to where they're going
      ;[p.s, p.u] = door
      const pl = PLACES[p.target]
      this.walkTo(p, pl.kind === 'park' ? parkPoint(pl, rng(p.seed + Math.floor(this.clock))()) : pl.door)
    }
    l.ridersToday += (leaving.length + coming.length) * PER_AGENT
  }

  // --- one step ------------------------------------------------------------------

  /** Advance the island by `minutes` of simulated time. */
  step(minutes: number) {
    if (!this.running || minutes <= 0) return
    // a long step (a slow frame at high speed) is cut up, so trips and cycles keep their order
    const parts = Math.ceil(minutes / 0.5)
    for (let k = 0; k < parts; k++) this.tick(minutes / parts)
  }

  private tick(dt: number) {
    const before = this.day
    this.clock += dt
    if (this.day !== before) this.newDay()
    const now = this.minute

    // schedules
    for (const p of this.people) {
      if (this.clock >= p.nextAt) {
        const stop = p.plan[p.next]
        p.thenAt = -1
        p.pendingThen = stop.then ?? null
        this.head(p, stop.place)
        p.next = (p.next + 1) % p.plan.length
        const at = this.dayBase() + p.plan[p.next].at
        p.nextAt = at > this.clock ? at : at + DAY
      } else if (p.thenAt >= 0 && this.clock >= p.thenAt) {
        p.thenAt = -1
        this.head(p, p.thenPlace)
      }
    }

    // the lines
    LINES.forEach((_, i) => {
      if (!this.lineOpen(i)) return
      const l = this.lines[i]
      while (this.clock >= l.nextAt) {
        this.trip(i)
        l.nextAt = this.nextTrip(i, l.nextAt)
      }
    })

    this.traffic(dt, now)

    // walking, and wandering in the parks
    this.present.fill(0)
    for (const p of this.people) {
      if (p.doing === 'walk') {
        if (move(p, p.speed * dt)) this.arrive(p)
      } else if (p.doing === 'park') {
        if (p.route.length) {
          if (move(p, p.speed * 0.45 * dt)) {
            p.route = []
            p.pause = 2 + 8 * rng(p.seed + Math.floor(this.clock * 7))()
          }
        } else if ((p.pause -= dt) <= 0) {
          const r = rng(p.seed + Math.floor(this.clock * 13))
          p.route = [[p.s, p.u], parkPoint(PLACES[p.target], r())]
          p.leg = 1
        }
        this.present[p.target]++
      } else if (p.doing === 'in') {
        this.present[p.target]++
      }
    }

    // trash: made in homes and hospitals, held in each building's chute
    PLACES.forEach((pl, i) => {
      if (!this.open[i] || !pl.avac) return
      if (pl.kind === 'home') this.chutes[i] += this.present[i] * PER_AGENT * HOME_TRASH * (awake(now) ? 1 : 0.15) * dt
      else if (pl.kind === 'hospital') this.chutes[i] += pl.people * HOSPITAL_TRASH * dt
    })
    const plant = placeIndex('AVAC plant')
    if (this.clock >= this.nextCycle) {
      this.nextCycle += AVAC_CYCLE
      let best = -1
      PLACES.forEach((pl, i) => {
        if (this.open[i] && pl.avac && this.chutes[i] >= AVAC_MIN && (best < 0 || this.chutes[i] > this.chutes[best])) best = i
      })
      if (best >= 0 && this.open[plant]) {
        const r = route(PLACES[best].door, PLACES[plant].door, 0)
        this.pulses.push({ route: r, leg: 1, s: r[0][0], u: r[0][1], kg: this.chutes[best] })
        this.chutes[best] = 0
      }
    }
    this.pulses = this.pulses.filter((q) => {
      if (!move(q, TUBE * dt)) return true
      this.collectedToday += q.kg
      return false
    })

    // electricity
    let kw = 0
    PLACES.forEach((pl, i) => {
      if (!this.open[i]) return
      const here = this.present[i] * PER_AGENT
      if (pl.kind === 'home') kw += pl.people * 0.2 + here * (awake(now) ? 0.45 : 0.15)
      else if (pl.kind === 'hospital') kw += pl.people * 2 + here * 0.5
      else if (pl.kind === 'campus') kw += pl.people * 0.4 + here
      else if (pl.kind === 'school' || pl.kind === 'shop') kw += pl.people * 0.2 + here
    })
    if (this.lineOpen(0) && lineRuns(0, now)) kw += 350 // the Tram's motors
    if (this.open[plant]) kw += 60 // the plant's exhaust fans: ~400 kW for the minute or so each cycle takes, averaged
    this.power = kw
    const slot = Math.floor(now / 10)
    this.today[slot] = kw / 1000
  }

  // --- traffic --------------------------------------------------------------------

  private addVehicle(kind: VehicleKind, speed: number, drives: Drive[]) {
    const first = drives[0].route[0]
    this.vehicles.push({
      kind,
      seed: this.vehicleSeed++,
      s: first[0],
      u: first[1],
      ds: 1,
      du: 0,
      speed,
      drives,
      part: 0,
      route: drives[0].route,
      leg: 1,
      waitUntil: 0,
    })
  }

  private traffic(dt: number, now: number) {
    if (!this.bridgeOpen()) {
      this.vehicles = []
      return
    }
    // the bus to Queens: it comes over the bridge to be at its stop when each trip leaves
    LINES.forEach((line, i) => {
      if (line.short !== 'Bus' || !this.lineOpen(i)) return
      const l = this.lines[i]
      const stop = PLACES[line.place].door
      const inbound = drive(BRIDGE, stop)
      const approach = pathLength(inbound) / BUS_DRIVE + 1
      if (l.busFor !== l.nextAt && this.clock >= l.nextAt - approach) {
        l.busFor = l.nextAt
        this.addVehicle('bus', BUS_DRIVE, [
          { route: inbound, dwell: 0.5, until: l.nextAt },
          { route: drive(stop, BRIDGE), dwell: 0 },
        ])
      }
    })
    // the red bus: from Motorgate down Main Street to the Tram, up to the north end, and back
    if (this.clock >= this.nextRedBus) {
      if (lineRuns(0, now)) {
        const garage = PLACES[placeIndex('Motorgate Garage')].door
        const tram = PLACES[placeIndex('Tramway island station')].door
        const north: [number, number] = [32, mainStreetU(32)]
        this.addVehicle('redbus', BUS_DRIVE, [
          { route: drive(garage, tram), dwell: 0.6 },
          { route: drive(tram, north), dwell: 0.4 },
          { route: drive(north, garage), dwell: 0 },
        ])
      }
      this.nextRedBus += rush(now) ? RED_BUS.peak : RED_BUS.offPeak
    }
    // cars: over the bridge to a door, a few minutes there, and back
    this.carsDue += carsPerMinute(now) * dt
    while (this.carsDue >= 1) {
      this.carsDue -= 1
      const r = rng(this.vehicleSeed * 31 + 7)
      const doors = PLACES.map((p, i) => (this.open[i] && p.people > 0 && p.kind !== 'park' ? i : OFF)).filter((i) => i !== OFF)
      if (!doors.length) break
      // weighted by how many live or work there
      let x = r() * doors.reduce((a, i) => a + PLACES[i].people, 0)
      let to = doors[0]
      for (const i of doors) if ((x -= PLACES[i].people) < 0) {
        to = i
        break
      }
      const door = PLACES[to].door
      this.addVehicle('car', DRIVE * (0.9 + 0.2 * r()), [
        { route: drive(BRIDGE, door), dwell: 1 + 6 * r() },
        { route: drive(door, BRIDGE), dwell: 0 },
      ])
    }

    this.vehicles = this.vehicles.filter((v) => {
      if (this.clock < v.waitUntil) return true
      const s0 = v.s
      const u0 = v.u
      if (move(v, v.speed * dt)) {
        const d = v.drives[v.part]
        v.part++
        if (v.part >= v.drives.length) return false
        v.waitUntil = Math.max(this.clock + d.dwell, d.until ?? 0)
        // set off from where it pulled up (the next drive was planned from the door)
        v.route = [[v.s, v.u], ...v.drives[v.part].route.slice(1)]
        v.leg = 1
      }
      const ds = v.s - s0
      const du = v.u - u0
      const len = Math.hypot(ds, du)
      if (len > 1e-6) {
        v.ds = ds / len
        v.du = du / len
      }
      return true
    })
  }

  /** The bridge to Queens: the island's only road on and off (1955). */
  private bridgeOpen() {
    return this.year >= 1955 && this.running
  }

  private newDay() {
    this.yesterday = this.today
    this.today = []
    this.collectedYesterday = this.collectedToday
    this.collectedToday = 0
    this.shopVisits = 0
    for (const l of this.lines) {
      l.ridersYesterday = l.ridersToday
      l.ridersToday = 0
    }
  }

  // --- readouts -------------------------------------------------------------------

  stats(): IslandLifeStats {
    const doing = { in: 0, walk: 0, park: 0, queue: 0, away: 0, inbound: 0 } as Record<Doing, number>
    const roles = Object.fromEntries(ROLES.map((r) => [r, 0])) as Record<Role, number>
    for (const p of this.people) {
      doing[p.doing] += PER_AGENT
      if (p.doing !== 'away' && p.doing !== 'inbound') roles[p.role] += PER_AGENT
    }
    let inChutes = 0
    PLACES.forEach((pl, i) => {
      if (this.open[i] && pl.avac) inChutes += this.chutes[i]
    })
    return {
      open: this.running,
      minute: this.minute,
      day: this.day,
      onIsland: doing.in + doing.walk + doing.park + doing.queue,
      offIsland: doing.away + doing.inbound,
      doing,
      roles,
      lines: LINES.map((l, i) => ({
        short: l.short,
        open: this.lineOpen(i),
        waiting: this.lines[i].outQ.length * PER_AGENT,
        arriving: this.lines[i].inQ.length * PER_AGENT,
        ridersToday: this.lines[i].ridersToday,
        ridersYesterday: this.lines[i].ridersYesterday,
      })),
      trash: { inChutes, collectedToday: this.collectedToday, collectedYesterday: this.collectedYesterday },
      powerMW: this.power / 1000,
      today: Array.from({ length: 144 }, (_, k) => this.today[k] ?? NaN),
      yesterday: Array.from({ length: 144 }, (_, k) => this.yesterday[k] ?? NaN),
      shopVisits: this.shopVisits,
      cars: this.vehicles.filter((v) => v.kind === 'car').length,
      buses: this.vehicles.filter((v) => v.kind !== 'car').length,
    }
  }

  /** Where a line's queue stands, and how many are in it (agents), for the labels and the crowd. */
  queueAt(i: number) {
    return this.lines[i].outQ
  }
}

// --- helpers ----------------------------------------------------------------------

function drop<T>(list: T[], x: T) {
  const k = list.indexOf(x)
  if (k >= 0) list.splice(k, 1)
}

function pickLine(weights: number[], x: number, preferTram: boolean): number {
  if (preferTram && weights[0] > 0 && x < 0.7) return 0
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i] / total
    if (x < acc) return i
  }
  return weights.length - 1
}

/** A point somewhere inside a park. */
function parkPoint(pl: Place, x: number): [number, number] {
  const a = x * Math.PI * 2 * 7.31
  const r = Math.sqrt((x * 9.7) % 1) * 0.8
  return [pl.s + Math.cos(a) * pl.hs * r, pl.u + Math.sin(a) * pl.hu * r]
}

/** A path along the middle of the island (Main Street's old line, which the AVAC tubes follow): out to it, along it, and in. */
export function route(from: [number, number], to: [number, number], lane: number): [number, number][] {
  const [s0, u0] = from
  const [s1, u1] = to
  const pts: [number, number][] = [[s0, u0]]
  if (Math.abs(s1 - s0) > 0.8) {
    const dir = Math.sign(s1 - s0)
    pts.push([s0, mainStreetU(s0) + lane])
    for (let s = s0 + dir * 2; dir * (s1 - s) > 0.5; s += dir * 2) pts.push([s, mainStreetU(s) + lane])
    pts.push([s1, mainStreetU(s1) + lane])
  }
  pts.push([s1, u1])
  return pts
}

/**
 * A walk from one point to another along the island's real streets: out to the
 * nearest pavement or footpath, along them, and in (see streets.ts). Next door,
 * straight across. Before the streets load, along the middle of the island.
 */
function walk(from: [number, number], to: [number, number], lane: number): [number, number][] {
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) < 0.8) return [from, to]
  return streetWalk(from, to, lane) ?? route(from, to, lane)
}

/**
 * Where the Roosevelt Island Bridge comes onto the island: at Motorgate, whose
 * ramps take the traffic down to Main Street (the bridge's deck is drawn by
 * the bridges layer; the vehicles start and end their runs here).
 */
const BRIDGE: [number, number] = (() => {
  const s = 12.4
  const e = islandEdges(s) ?? [-1, 4.4]
  return [s, e[1] - 0.3]
})()

/**
 * A drive along the streets, on the right: from a point (the bridge, or a stop at
 * the kerb) to the kerb beside a door, or on to the bridge. Vehicles pull up at
 * the kerb; only the bridge takes them off the street.
 */
function drive(from: [number, number], to: [number, number]): [number, number][] {
  // on the island's real streets, on the right (streets.ts); the bridge's end is just off East Road
  const real = streetDrive(from, to)
  if (real) return [...(from === BRIDGE ? [BRIDGE] : []), ...real, ...(to === BRIDGE ? [BRIDGE] : [])]
  // before the streets load: along the middle of the island
  const lane = (Math.sign(to[0] - from[0]) || 1) * DRIVE_LANE
  const end: [number, number] = to === BRIDGE ? to : [to[0], mainStreetU(to[0]) + lane]
  const r = route(from, end, lane)
  // a stop at the kerb ends on the street: drop the step in to the door that route() adds
  return to === BRIDGE ? r : r.filter((p, k) => k === r.length - 1 || Math.hypot(p[0] - end[0], p[1] - end[1]) > 1e-6)
}

function pathLength(r: [number, number][]) {
  let d = 0
  for (let k = 1; k < r.length; k++) d += Math.hypot(r[k][0] - r[k - 1][0], r[k][1] - r[k - 1][1])
  return d
}

/** Move along a route by `dist`; true when the end is reached. */
function move(p: { route: [number, number][]; leg: number; s: number; u: number }, dist: number): boolean {
  while (dist > 0 && p.leg < p.route.length) {
    const [ts, tu] = p.route[p.leg]
    const ds = ts - p.s
    const du = tu - p.u
    const d = Math.hypot(ds, du)
    if (d <= dist) {
      p.s = ts
      p.u = tu
      p.leg++
      dist -= d
    } else {
      p.s += (ds / d) * dist
      p.u += (du / d) * dist
      dist = 0
    }
  }
  return p.leg >= p.route.length
}
