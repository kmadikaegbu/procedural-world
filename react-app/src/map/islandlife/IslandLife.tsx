import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import { CapsuleGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { height, shapeKey, type TerrainParams } from '../noise'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { islandXZ } from '../world/island'
import { isOpen, LINES, PLACES, placeIndex, TOWN_OPENS } from './places'
import { IslandLifeSim, route, setActiveIslandSim, type IslandLifeStats } from './sim'
import { ROLE_INFO, TRASH_COLOR, type IslandLifeSettings } from './settings'

/**
 * ISLAND LIFE ON THE MAP: the people of Roosevelt Island walking Main Street,
 * crowding the stations at the rush hours and spending the afternoon in the
 * parks, coloured by who they are. With Flows on, the AVAC tubes under Main
 * Street are drawn, with each building's trash shooting along them to the
 * plant, and each station is labelled with its queue. See sim.ts.
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
    const mesh = people.current
    if (mesh) {
      let n = 0
      const queued = new Map<object, number>()
      LINES.forEach((_, i) => sim.queueAt(i).forEach((p, k) => queued.set(p, k)))
      for (const p of sim.people) {
        if (n >= ROOM) break
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
        const h = groundAt(s, u)
        const size = base * boost(x, h, z)
        mat.makeScale(size, size, size).setPosition(x, h, z)
        mesh.setMatrixAt(n, mat)
        mesh.setColorAt(n, colors[p.role])
        n++
      }
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.visible = n > 0
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
