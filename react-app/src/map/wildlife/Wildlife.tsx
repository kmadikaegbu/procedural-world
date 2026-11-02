import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { shapeKey, type TerrainParams } from '../noise'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { BODIES, BODY_COLOR, STATE_COLOR, visionCone } from './shapes'
import { FOX, REAL_LENGTH, SPECIES, WildlifeSim, type Species, type WildlifeStats } from './sim'
import type { WildlifeSettings } from './settings'

/** Room in each species' mesh: the slider maximum, twice over for newborns and leavers. */
const ROOM: Record<Species, number> = { bird: 600, deer: 300, fox: 60 }
/** Longest step the simulation takes, so a slow frame can't fling animals across the map. */
const MAX_DT = 0.05

const up = new Vector3(0, 1, 0)
const pos = new Vector3()
const scl = new Vector3()
const rot = new Quaternion()
const mat = new Matrix4()
const col = new Color()

/**
 * THE ANIMALS, drawn. The simulation (sim.ts) runs every frame; this copies
 * where each animal is into one instanced mesh per species, so the whole
 * population costs three draw calls.
 */
export function Wildlife({
  params,
  settings,
  cityReach,
  paving,
  running,
  scaleMode,
  resetKey,
  onStats,
}: {
  params: TerrainParams
  settings: WildlifeSettings
  /** How far the city has grown (from the timeline): animals can't live where it's paved. */
  cityReach: number
  paving: number
  running: boolean
  scaleMode: ScaleMode
  /** Change it to start the population over. */
  resetKey: number
  onStats?: (s: WildlifeStats) => void
}) {
  const sim = useMemo(() => new WildlifeSim(), [])
  const meshes = useRef<Partial<Record<Species, InstancedMesh | null>>>({})
  const cones = useRef<InstancedMesh>(null)
  const habitatKey = useRef('')
  const populated = useRef(-1)
  const report = useRef(0)

  // re-sample the terrain when its shape changes; the animals stay where they are
  useLayoutEffect(() => {
    sim.habitat.build(params)
    habitatKey.current = '' // force the land/wild pass next frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, ...shapeKey(params)])

  const materials = useMemo(() => {
    const body = new MeshStandardMaterial({ roughness: 0.9, side: DoubleSide })
    const cone = new MeshBasicMaterial({
      color: STATE_COLOR.hunt,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: DoubleSide,
    })
    return { body, cone }
  }, [])
  useEffect(() => () => {
    materials.body.dispose()
    materials.cone.dispose()
  }, [materials])
  const coneGeometry = useMemo(() => visionCone(FOX.fov), [])
  useEffect(() => () => coneGeometry.dispose(), [coneGeometry])

  useFrame((state, delta) => {
    // the sea and the city move with the timeline: re-decide what's wild when they do
    const key = `${params.seaLevel.toFixed(2)}|${cityReach.toFixed(0)}|${paving.toFixed(2)}`
    if (key !== habitatKey.current) {
      habitatKey.current = key
      sim.habitat.update(params.seaLevel, cityReach, paving)
    }
    if (populated.current !== resetKey) {
      populated.current = resetKey
      sim.populate(settings, params)
    }
    if (running) sim.step(Math.min(delta, MAX_DT), settings, params)

    draw(state.clock.elapsedTime)

    if (onStats && (report.current -= delta) <= 0) {
      report.current = 0.5
      onStats(sim.stats(settings))
    }
  })

  function draw(time: number) {
    const sizeOf = (sp: Species) => m(REAL_LENGTH[sp]) * EXAGGERATION[scaleMode].objects * settings.size
    const filled: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }
    let coneCount = 0
    const coneMesh = cones.current

    for (const a of sim.agents) {
      const mesh = meshes.current[a.species]
      const k = filled[a.species]
      if (!mesh || k >= ROOM[a.species]) continue
      filled[a.species]++

      const s = sizeOf(a.species) * Math.max(0, a.grow)
      // birds beat their wings: the wingtips swing up and down
      const flap = a.species === 'bird' ? 1.5 * Math.sin(time * 12 + a.id) : 1
      rot.setFromAxisAngle(up, a.heading)
      mat.compose(pos.set(a.x, a.y, a.z), rot, scl.set(s, s * flap, s))
      mesh.setMatrixAt(k, mat)
      mesh.setColorAt(k, col.set(settings.showStates ? STATE_COLOR[a.state] : BODY_COLOR[a.species]))

      if (coneMesh && settings.showStates && a.species === 'fox' && a.state !== 'leaving') {
        mat.compose(pos.set(a.x, a.y + 0.15, a.z), rot, scl.set(FOX.sight, 1, FOX.sight))
        coneMesh.setMatrixAt(coneCount++, mat)
      }
    }

    for (const sp of SPECIES) {
      const mesh = meshes.current[sp]
      if (!mesh) continue
      mesh.count = filled[sp]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    if (coneMesh) {
      coneMesh.count = coneCount
      coneMesh.instanceMatrix.needsUpdate = true
    }
  }

  return (
    <group>
      {SPECIES.map((sp) => (
        <instancedMesh
          key={sp}
          ref={(mesh) => {
            meshes.current[sp] = mesh
          }}
          args={[BODIES[sp], materials.body, ROOM[sp]]}
          castShadow
          frustumCulled={false} // the animals roam; the mesh's bounds are never up to date
          raycast={() => null} // the brushes paint the ground, not the deer
        />
      ))}
      <instancedMesh
        ref={cones}
        args={[coneGeometry, materials.cone, ROOM.fox]}
        frustumCulled={false}
        raycast={() => null}
        renderOrder={1}
      />
    </group>
  )
}
