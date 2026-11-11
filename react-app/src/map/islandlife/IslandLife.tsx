import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import {
  CapsuleGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { height, shapeKey, type TerrainParams } from '../noise'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { modelMaterials } from '../wildlife/models'
import { ACROSS, islandXZ, SPINE } from '../world/island'
import {
  loadIslandModels,
  PERSON_KEYS,
  PERSON_ROOM,
  VEHICLE_KEYS,
  VEHICLE_ROOM,
  vehicleMaterial,
  type IslandModels,
  type PersonClip,
  type PersonKey,
  type VehicleModelKey,
} from './models'
import { isOpen, LINES, mainStreetU, PLACES, placeIndex, TOWN_OPENS } from './places'
import { IslandLifeSim, route, setActiveIslandSim, type IslandLifeStats, type Person, type Vehicle } from './sim'
import { ROLE_INFO, TRASH_COLOR, type IslandLifeSettings } from './settings'

/**
 * ISLAND LIFE ON THE MAP: the people of Roosevelt Island walking Main Street's
 * sidewalks, crowding the stations at the rush hours and spending the
 * afternoon in the parks, and the buses and cars on Main Street. People and
 * vehicles are drawn with real low-poly models (models.ts): people walk and
 * stand with their own animations, in their own clothes or tinted by who they
 * are. With Flows on, the AVAC tubes under Main Street are drawn, with each
 * building's trash shooting along them to the plant, and each station is
 * labelled with its queue. See sim.ts.
 */

/**
 * Nearer than this (world units, ~200 m) people are drawn at their true height;
 * farther, they grow with distance, like symbols on a map, so a crowd still reads
 * from above the island.
 */
const NEAR_VIEW = 6
const ROOM = 3000
const PULSE_ROOM = 40
/** A person's height, metres. */
const PERSON_M = 1.7
/** Longest frame the simulation takes in one go, seconds. */
const MAX_DT = 0.1
/** The streets are drawn this far above the ground (city/City.tsx), so whoever is on one stands on it. */
const ROAD_LIFT = 0.1
/** How far either side of Main Street's middle its road and sidewalks reach, units. */
const ROAD_HALF = 0.32
/** On Main Street, how high its surface is above the ground; easing off over a short step at its edge. */
const streetLift = (s: number, u: number) =>
  ROAD_LIFT * Math.min(1, Math.max(0, (ROAD_HALF + 0.06 - Math.abs(u - mainStreetU(s))) / 0.12))

/** Vehicles are enlarged with distance too, but by no more than this: a bus many times its size would bury Main Street. */
const VEHICLE_BOOST = 3
/** Seconds to fade from one animation to the next. */
const CLIP_FADE = 0.25

/** Real lengths, metres. The red bus is shorter than the MTA's 40-footers. */
const VEHICLE_M: Record<VehicleModelKey, number> = { car: 4.5, sedan: 4.8, suv: 4.9, pickup: 5.6, van: 5.4, bus: 12.2 }
const RED_BUS_M = 10
/** The mix of cars on the road, and of their paint: about one in six is a yellow cab. */
const CAR_MIX: [VehicleModelKey, number][] = [['car', 0.3], ['sedan', 0.3], ['suv', 0.2], ['van', 0.12], ['pickup', 0.08]]
const PAINT: [string, number][] = [
  ['#f2b705', 0.16], // taxi
  ['#e9ecef', 0.22],
  ['#1b1d21', 0.18],
  ['#a7adb4', 0.15],
  ['#5d636b', 0.12],
  ['#24457a', 0.08],
  ['#9b1d20', 0.06],
  ['#2f5a3c', 0.03],
]
const BUS_PAINT = '#dfe6ea' // the MTA's white and blue
/** What people wear: their shirt, top or dress. */
const CLOTHES = ['#26344f', '#e6e6e0', '#7fa7d1', '#a2312c', '#3d6b47', '#7a7d82', '#c9b38f', '#1c1c1f', '#d9a62e', '#d48aa5', '#5a3f6e', '#c8642d']
const RED_BUS_PAINT = '#c41e2a'

/** Pick from a weighted list with x in [0, 1). */
function pickWeighted<T>(list: [T, number][], x: number): T {
  for (const [v, w] of list) if ((x -= w) < 0) return v
  return list[list.length - 1][0]
}
/** A steady number in [0, 1) from a seed. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Which model a person is drawn with: men and women, half of the commuters and campus people dressed for the office. */
function personKey(p: Person): PersonKey {
  const formal = { commuter: 0.6, campus: 0.4, teacher: 0.5 }[p.role as string] ?? 0.15
  const woman = hash(p.seed) < 0.5
  const dressed = hash(p.seed + 1) < formal
  return woman ? (dressed ? 'womanDress' : 'woman') : dressed ? 'manSuit' : 'man'
}

interface ClipState {
  clip: PersonClip
  t: number
  prev: PersonClip
  prevT: number
  fade: number
}

// the ground of the island, sampled once on a grid in its own frame
const S0 = -52
const S1 = 48
const U0 = -14
const U1 = 14
const STEP = 0.5
const NS = Math.round((S1 - S0) / STEP) + 1
const NU = Math.round((U1 - U0) / STEP) + 1

export function IslandLife({
  params,
  year,
  settings,
  running,
  scaleMode,
  onStats,
}: {
  params: TerrainParams
  year: number
  settings: IslandLifeSettings
  running: boolean
  scaleMode: ScaleMode
  onStats?: (s: IslandLifeStats) => void
}) {
  const sim = useMemo(() => new IslandLifeSim(), [])
  useEffect(() => {
    setActiveIslandSim(sim)
    return () => setActiveIslandSim(null)
  }, [sim])

  // ground height on a grid over the island, so a thousand people don't each sample the noise every frame
  const ground = useMemo(() => {
    const g = new Float32Array(NS * NU)
    for (let i = 0; i < NS; i++)
      for (let j = 0; j < NU; j++) {
        const [x, z] = islandXZ(S0 + i * STEP, U0 + j * STEP)
        g[i * NU + j] = Math.max(height(x, z, params), params.seaLevel)
      }
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...shapeKey(params), params.seaLevel > 0.5])
  const groundAt = (s: number, u: number) => {
    const fi = Math.min(NS - 1.001, Math.max(0, (s - S0) / STEP))
    const fj = Math.min(NU - 1.001, Math.max(0, (u - U0) / STEP))
    const i = Math.floor(fi)
    const j = Math.floor(fj)
    const a = fi - i
    const b = fj - j
    const g00 = ground[i * NU + j]
    const g10 = ground[(i + 1) * NU + j]
    const g01 = ground[i * NU + j + 1]
    const g11 = ground[(i + 1) * NU + j + 1]
    return (g00 * (1 - a) + g10 * a) * (1 - b) + (g01 * (1 - a) + g11 * a) * b
  }

  const people = useRef<InstancedMesh>(null)
  const pulses = useRef<InstancedMesh>(null)
  const personGeometry = useMemo(() => new CapsuleGeometry(0.16, 0.68, 3, 8).translate(0, 0.5, 0), [])
  const personMaterial = useMemo(() => new MeshStandardMaterial({ roughness: 0.7 }), [])
  const pulseGeometry = useMemo(() => new SphereGeometry(1, 12, 8), [])
  const pulseMaterial = useMemo(() => new MeshBasicMaterial({ color: TRASH_COLOR }), [])
  useEffect(
    () => () => {
      personGeometry.dispose()
      personMaterial.dispose()
      pulseGeometry.dispose()
      pulseMaterial.dispose()
    },
    [personGeometry, personMaterial, pulseGeometry, pulseMaterial],
  )
  const colors = useMemo(
    () => Object.fromEntries(Object.entries(ROLE_INFO).map(([k, v]) => [k, new Color(v.color)])) as Record<string, Color>,
    [],
  )
  const clothes = useMemo(() => CLOTHES.map((c) => new Color(c)), [])
  const paints = useMemo(() => {
    const paint = new Map<string, Color>()
    for (const [hex] of PAINT) paint.set(hex, new Color(hex))
    paint.set(BUS_PAINT, new Color(BUS_PAINT))
    paint.set(RED_BUS_PAINT, new Color(RED_BUS_PAINT))
    return paint
  }, [])

  // the real models (models.ts); until they've loaded, or if they can't be, people are drawn as capsules
  const [models, setModels] = useState<IslandModels | null>(null)
  useEffect(() => {
    let live = true
    loadIslandModels()
      .then((x) => live && setModels(x))
      .catch((err) => console.warn('Island life models failed to load; drawing people as capsules.', err))
    return () => {
      live = false
    }
  }, [])
  // how far each person's colour is their role's (0 = their own clothes)
  const tint = useMemo(() => ({ value: 0 }), [])
  const personMats = useMemo(() => {
    if (!models) return null
    const out = {} as Record<PersonKey, ReturnType<typeof modelMaterials>>
    for (const key of PERSON_KEYS) out[key] = modelMaterials(models.people[key], tint, { lift: 0.7, fill: 0.35 })
    return out
  }, [models, tint])
  const carMaterial = useMemo(() => vehicleMaterial(), [])
  useEffect(
    () => () => {
      if (personMats)
        for (const key of PERSON_KEYS) {
          personMats[key].body.dispose()
          personMats[key].depth.dispose()
        }
    },
    [personMats],
  )
  useEffect(() => () => carMaterial.dispose(), [carMaterial])
  const personMeshes = useRef<Partial<Record<PersonKey, InstancedMesh | null>>>({})
  const vehicleMeshes = useRef<Partial<Record<VehicleModelKey, InstancedMesh | null>>>({})
  const clipStates = useMemo(() => new WeakMap<Person, ClipState>(), [])
  const headings = useMemo(() => new WeakMap<object, number>(), [])
  const scratch = useMemo(
    () => ({ rot: new Quaternion(), pos: new Vector3(), scl: new Vector3(), up: new Vector3(0, 1, 0) }),
    [],
  )

  // the tubes: one from each connected building's door, along Main Street, to the plant
  const y = Math.floor(year)
  const tubes = useMemo(() => {
    const plant = PLACES[placeIndex('AVAC plant')]
    if (y < TOWN_OPENS || !isOpen(plant, y)) return []
    return PLACES.filter((p) => p.avac && isOpen(p, y)).map((p) =>
      route(p.door, plant.door, 0).map(([s, u]) => {
        const [x, z] = islandXZ(s, u)
        return [x, groundAt(s, u) + 0.15, z] as [number, number, number]
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y, ground])

  const labels = useMemo(
    () =>
      [...LINES.map((l) => l.place), placeIndex('AVAC plant')].map((i) => {
        const [s, u] = PLACES[i].door
        const [x, z] = islandXZ(s, u)
        return { i, at: [x, groundAt(s, u) + 1.2, z] as [number, number, number] }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ground],
  )
  const labelText = useRef<(HTMLDivElement | null)[]>([])

  const viewer = useRef(new Vector3())
  const report = useRef(0)
  const mat = useMemo(() => new Matrix4(), [])

  useFrame((state, delta) => {
    sim.setYear(year)
    if (running) sim.step(Math.min(delta, MAX_DT) * settings.speed)
    viewer.current.copy(state.camera.position)
    const view = viewer.current
    const base = m(PERSON_M) * EXAGGERATION[scaleMode].objects
    const boost = (x: number, h: number, z: number) =>
      Math.min(settings.size, Math.max(1, Math.hypot(x - view.x, h - view.y, z - view.z) / NEAR_VIEW))

    // people: only those outdoors are drawn
    const dt = running ? Math.min(delta, MAX_DT) : 0
    tint.value = settings.roleColors ? 0.8 : 0
    const { rot, pos, scl, up } = scratch
    /** Turn smoothly toward a direction given in the island frame, and return the heading (radians about y). */
    const face = (key: object, ds: number, du: number, rate: number) => {
      let h = headings.get(key) ?? 0
      if (Math.hypot(ds, du) > 1e-5) {
        const want = Math.atan2(SPINE[0] * ds + ACROSS[0] * du, SPINE[1] * ds + ACROSS[1] * du)
        const turn = Math.atan2(Math.sin(want - h), Math.cos(want - h))
        h += turn * Math.min(1, rate)
      }
      headings.set(key, h)
      return h
    }
    const capsules = people.current
    const filled = Object.fromEntries(PERSON_KEYS.map((k) => [k, 0])) as Record<PersonKey, number>
    let n = 0
    const queued = new Map<object, number>()
    LINES.forEach((_, i) => sim.queueAt(i).forEach((p, k) => queued.set(p, k)))
    for (const p of sim.people) {
      if (p.doing !== 'walk' && p.doing !== 'park' && p.doing !== 'queue') continue
      let s = p.s
      let u = p.u
      if (p.doing === 'queue') {
        // a crowd round the station door, filling outward
        const k = queued.get(p) ?? 0
        const a = k * 2.4
        const r = 0.2 * Math.sqrt(k + 1)
        s += Math.cos(a) * r
        u += Math.sin(a) * r
      }
      const [x, z] = islandXZ(s, u)
      const h = groundAt(s, u) + streetLift(s, u)
      // children are shorter, and no two grown-ups quite the same height
      const tall = p.role === 'child' ? 0.72 : 0.92 + 0.14 * hash(p.seed + 2)
      const size = base * boost(x, h, z) * tall

      if (!models) {
        if (!capsules || n >= ROOM) continue
        mat.makeScale(size, size, size).setPosition(x, h, z)
        capsules.setMatrixAt(n, mat)
        capsules.setColorAt(n, colors[p.role])
        n++
        continue
      }
      const key = personKey(p)
      const mesh = personMeshes.current[key]
      const k = filled[key]
      if (!mesh || k >= PERSON_ROOM) continue
      filled[key]++
      const model = models.people[key]

      // which way they face: along their walk, or at the station door while they wait
      let ds = 0
      let du = 0
      if (p.doing === 'queue') {
        const door = PLACES[LINES[p.line].place].door
        ds = door[0] - s
        du = door[1] - u
      } else if (p.route.length && p.leg < p.route.length) {
        ds = p.route[p.leg][0] - p.s
        du = p.route[p.leg][1] - p.u
      }
      const heading = face(p, ds, du, dt * 10)

      // walk while moving, stand otherwise; a short fade between the two
      const want: PersonClip = p.doing === 'walk' || (p.doing === 'park' && p.route.length > 0) ? 'walk' : 'idle'
      let c = clipStates.get(p)
      if (!c) {
        c = { clip: want, t: hash(p.seed + 3), prev: want, prevT: 0, fade: 1 }
        clipStates.set(p, c)
      }
      if (want !== c.clip) {
        c.prev = c.clip
        c.prevT = c.t
        c.clip = want
        c.t = 0
        c.fade = 0
      }
      // time on the island runs many times faster than the walk: the legs keep a brisk, natural pace instead
      const rate = (clip: PersonClip) => (clip === 'walk' ? 1.4 : 1) / model.clips[clip].duration
      c.t = (c.t + rate(c.clip) * dt) % 1
      c.prevT = (c.prevT + rate(c.prev) * dt) % 1
      c.fade = Math.min(1, c.fade + dt / CLIP_FADE)
      const from = model.clips[c.prev]
      const to = model.clips[c.clip]
      model.clipFrom.setXYZW(k, from.start, from.frames, c.prevT, c.fade)
      model.clipTo.setXYZW(k, to.start, to.frames, c.t, 0)

      rot.setFromAxisAngle(up, heading)
      mat.compose(pos.set(x, h, z), rot, scl.set(size, size, size))
      mesh.setMatrixAt(k, mat)
      mesh.setColorAt(k, settings.roleColors ? colors[p.role] : clothes[Math.floor(hash(p.seed + 6) * clothes.length)])
    }
    if (capsules) {
      capsules.count = n
      capsules.instanceMatrix.needsUpdate = true
      if (capsules.instanceColor) capsules.instanceColor.needsUpdate = true
      capsules.visible = n > 0
    }
    if (models)
      for (const key of PERSON_KEYS) {
        const mesh = personMeshes.current[key]
        if (!mesh) continue
        mesh.count = filled[key]
        models.people[key].clipFrom.needsUpdate = true
        models.people[key].clipTo.needsUpdate = true
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }

    // the buses and cars on Main Street
    if (models) {
      const vfilled = Object.fromEntries(VEHICLE_KEYS.map((k) => [k, 0])) as Record<VehicleModelKey, number>
      const objects = EXAGGERATION[scaleMode].objects
      for (const v of sim.vehicles) {
        const key = vehicleKey(v)
        const mesh = vehicleMeshes.current[key]
        const k = vfilled[key]
        if (!mesh || k >= VEHICLE_ROOM) continue
        vfilled[key]++
        const [x, z] = islandXZ(v.s, v.u)
        const h = groundAt(v.s, v.u) + streetLift(v.s, v.u)
        const lenM = v.kind === 'redbus' ? RED_BUS_M : VEHICLE_M[key]
        const size = m(lenM) * objects * Math.min(VEHICLE_BOOST, boost(x, h, z))
        rot.setFromAxisAngle(up, face(v, v.ds, v.du, dt * 8))
        mat.compose(pos.set(x, h, z), rot, scl.set(size, size, size))
        mesh.setMatrixAt(k, mat)
        const paint = v.kind === 'bus' ? BUS_PAINT : v.kind === 'redbus' ? RED_BUS_PAINT : pickWeighted(PAINT, hash(v.seed + 5))
        mesh.setColorAt(k, paints.get(paint)!)
      }
      for (const key of VEHICLE_KEYS) {
        const mesh = vehicleMeshes.current[key]
        if (!mesh) continue
        mesh.count = vfilled[key]
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    }

    // the trash in the tubes
    const pm = pulses.current
    if (pm) {
      let n = 0
      if (settings.flows)
        for (const q of sim.pulses) {
          if (n >= PULSE_ROOM) break
          const [x, z] = islandXZ(q.s, q.u)
          const h = groundAt(q.s, q.u) + 0.1
          const size = 0.12 * boost(x, h, z) * Math.min(1.6, 0.6 + Math.sqrt(q.kg) / 12)
          mat.makeScale(size, size, size).setPosition(x, h, z)
          pm.setMatrixAt(n++, mat)
        }
      pm.count = n
      pm.instanceMatrix.needsUpdate = true
      pm.visible = n > 0
    }

    if ((report.current -= delta) <= 0) {
      report.current = 0.25
      const st = sim.stats()
      if (onStats) onStats(st)
      labels.forEach((l, k) => {
        const el = labelText.current[k]
        if (!el) return
        const line = LINES.findIndex((x) => x.place === l.i)
        if (line >= 0) {
          const info = st.lines[line]
          el.textContent = info.open ? `${LINES[line].short}: ${info.waiting} waiting` : ''
        } else {
          el.textContent = st.open ? `AVAC plant: ${(st.trash.collectedToday / 1000).toFixed(1)} t today` : ''
        }
        el.style.display = el.textContent ? '' : 'none'
      })
    }
  })

  if (year < TOWN_OPENS) return null

  return (
    <group>
      <instancedMesh ref={people} args={[personGeometry, personMaterial, ROOM]} frustumCulled={false} />
      {models &&
        personMats &&
        PERSON_KEYS.map((key) => (
          <instancedMesh
            key={key}
            ref={(mesh) => {
              personMeshes.current[key] = mesh
            }}
            args={[models.people[key].geometry, personMats[key].body, PERSON_ROOM]}
            customDepthMaterial={personMats[key].depth}
            castShadow
            frustumCulled={false} // people move about; the mesh's bounds are never up to date
            raycast={() => null}
          />
        ))}
      {models &&
        VEHICLE_KEYS.map((key) => (
          <instancedMesh
            key={key}
            ref={(mesh) => {
              vehicleMeshes.current[key] = mesh
            }}
            args={[models.vehicles[key].geometry, carMaterial, VEHICLE_ROOM]}
            castShadow
            frustumCulled={false}
            raycast={() => null}
          />
        ))}
      <instancedMesh ref={pulses} args={[pulseGeometry, pulseMaterial, PULSE_ROOM]} frustumCulled={false} renderOrder={11} />
      {settings.flows && (
        <>
          {tubes.map((pts, k) => (
            <Line key={k} points={pts} color={TRASH_COLOR} lineWidth={2} transparent opacity={0.6} dashed dashSize={0.4} gapSize={0.25} />
          ))}
          {labels.map((l, k) => (
            <Html key={l.i} position={l.at} center zIndexRange={[3, 0]} style={{ pointerEvents: 'none' }}>
              <div className="life-label" ref={(el) => void (labelText.current[k] = el)} />
            </Html>
          ))}
        </>
      )}
    </group>
  )
}

/** The model a vehicle is drawn with. */
function vehicleKey(v: Vehicle): VehicleModelKey {
  return v.kind === 'car' ? pickWeighted(CAR_MIX, hash(v.seed + 4)) : 'bus'
}
