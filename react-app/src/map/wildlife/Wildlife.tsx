import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  CircleGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { shapeKey, type TerrainParams } from '../noise'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { BODIES, STATE_COLOR, visionCone } from './shapes'
import { envFrom, FOX, REAL_LENGTH, SPECIES, TRACK_LIFE, WildlifeSim, type Species, type WildlifeStats } from './sim'
import type { Season } from '../trees/seasons'
import { WEATHER_DEFAULTS, type WeatherParams } from '../../weather/presets'
import type { WildlifeSettings } from './settings'

/** Room in each species' mesh: the slider maximum, twice over for newborns and leavers. */
const ROOM: Record<Species, number> = { bird: 600, deer: 300, fox: 60 }
/** Longest step the simulation takes, so a slow frame can't fling animals across the map. */
const MAX_DT = 0.05

// --- animation, done in the vertex shader -------------------------------------------
// Each animal carries four numbers (aAnim): its stride/flap phase, how much it is
// moving (0 = standing, 1 = full stride), how far its head is down grazing, and
// whether it has antlers. The shapes carry per-vertex weights (shapes.ts).
const ANIM_HEADER = /* glsl */ `
attribute vec4 aPart;     // leg swing, leg-pair phase, head-follow, wing-flap weights
attribute float aFlag;    // 1 on antlers
attribute vec4 aAnim;     // phase, moving, grazing, antlers
uniform float uStates;
`
const ANIM_VERT = /* glsl */ `
#include <begin_vertex>
// legs: swing back and forth along the body, the foot lifting as it comes forward
float aph = aAnim.x + aPart.y;
transformed.z += sin(aph) * aPart.x * 0.2 * aAnim.y;
transformed.y += max(0.0, cos(aph)) * aPart.x * aPart.x * 0.09 * aAnim.y;
// the whole body rocks a little with each stride
transformed.y += abs(sin(aAnim.x)) * 0.012 * aAnim.y * (1.0 - aPart.x);
// head and neck dip: to graze (1) or drink (1.3), or lift to watch (below 0)
transformed.y *= 1.0 - 0.7 * aPart.z * aAnim.z;
transformed.z += aPart.z * aAnim.z * 0.12;
// wings folded in when a bird has landed (aAnim.z is the fold for birds)
float fold = clamp(aAnim.z, 0.0, 1.0) * step(0.001, aPart.w);
transformed.x *= mix(1.0, 0.16, fold);
transformed.y += fold * 0.04;
// wings: the tips beat up and down (aAnim.y is how hard: less when gliding)
transformed.y += aPart.w * (sin(aAnim.x) * 0.32 * aAnim.y + 0.02) * (1.0 - fold);
transformed.z -= aPart.w * (cos(aAnim.x) * 0.04 * aAnim.y);
// antlers exist only on some deer
transformed *= mix(1.0, aAnim.w, aFlag);
`
const ANIM_COLOR = /* glsl */ `
#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = mix(vColor.xyz, instanceColor.xyz, uStates);
#endif
`

function animalMaterial(uStates: IUniform<number>): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide, vertexColors: true })
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uStates = uStates
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ANIM_HEADER}`)
      .replace('#include <begin_vertex>', ANIM_VERT)
      .replace('#include <color_vertex>', ANIM_COLOR)
  }
  return mat
}

const up = new Vector3(0, 1, 0)
const right = new Vector3(-1, 0, 0) // rotating about -x lifts the nose (+z) for a positive angle
const forward = new Vector3(0, 0, 1)
const pitch = new Quaternion()
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
  weather = WEATHER_DEFAULTS,
  season = 'summer',
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
  /** Night, rain, snow and wind change what the animals do. */
  weather?: WeatherParams
  /** Birds migrate with the seasons; animals drink more in summer. */
  season?: Season
  /** Change it to start the population over. */
  resetKey: number
  onStats?: (s: WildlifeStats) => void
}) {
  const sim = useMemo(() => new WildlifeSim(), [])
  const meshes = useRef<Partial<Record<Species, InstancedMesh | null>>>({})
  const cones = useRef<InstancedMesh>(null)
  const prints = useRef<InstancedMesh>(null)
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
    const states: IUniform<number> = { value: 0 }
    const body = animalMaterial(states)
    const cone = new MeshBasicMaterial({
      color: STATE_COLOR.hunt,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: DoubleSide,
    })
    const print = new MeshBasicMaterial({
      color: '#2a1d12',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    })
    return { body, cone, states, print }
  }, [])
  useEffect(() => () => {
    materials.body.dispose()
    materials.cone.dispose()
    materials.print.dispose()
  }, [materials])
  // per-animal animation numbers, one block per species mesh
  const anims = useMemo(() => {
    const out = {} as Record<Species, InstancedBufferAttribute>
    for (const sp of SPECIES) {
      out[sp] = new InstancedBufferAttribute(new Float32Array(ROOM[sp] * 4), 4)
      BODIES[sp].setAttribute('aAnim', out[sp])
    }
    return out
  }, [])
  // each animal's stride/flap phase, kept as it moves so a change of speed doesn't jerk the legs
  const phases = useMemo(() => new WeakMap<object, number>(), [])
  const coneGeometry = useMemo(() => visionCone(FOX.fov), [])
  // a hoof or paw print: a small flat oval
  const printGeometry = useMemo(() => new CircleGeometry(1, 8).rotateX(-Math.PI / 2), [])
  useEffect(() => () => printGeometry.dispose(), [printGeometry])
  useEffect(() => () => coneGeometry.dispose(), [coneGeometry])

  useFrame((_, delta) => {
    // the sea and the city move with the timeline: re-decide what's wild when they do
    const key = `${params.seaLevel.toFixed(2)}|${cityReach.toFixed(0)}|${paving.toFixed(2)}`
    if (key !== habitatKey.current) {
      habitatKey.current = key
      sim.habitat.update(params.seaLevel, cityReach, paving)
    }
    sim.env = envFrom(weather, season)
    if (populated.current !== resetKey) {
      populated.current = resetKey
      sim.populate(settings, params)
    }
    if (running) sim.step(Math.min(delta, MAX_DT), settings, params)

    draw(running ? Math.min(delta, MAX_DT) : 0)

    if (onStats && (report.current -= delta) <= 0) {
      report.current = 0.5
      onStats(sim.stats(settings))
    }
  })

  function draw(dt: number) {
    materials.states.value = settings.showStates ? 1 : 0
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
      const anim = anims[a.species]
      let moving = 0
      let third = 0 // aAnim.z: how far the head is down (ground animals) or the wings folded (birds)
      let rate = 0
      rot.setFromAxisAngle(up, a.heading)
      if (a.species === 'bird') {
        const fast = Math.hypot(a.vx, a.vz)
        const climb = Math.atan2(a.vy, Math.max(fast, 0.1))
        const standing = a.landed
        // flap hard when climbing or level, glide when sinking; stand with the wings folded
        moving = standing ? 0 : a.vy < -0.6 ? 0.12 : 0.7 + 0.3 * Math.min(1, Math.max(0, a.vy / 2))
        rate = standing ? 0 : 11 + (a.id % 5)
        third = standing ? 1 : 0
        // nose up in a climb, wing down in a turn
        rot.multiply(pitch.setFromAxisAngle(right, standing ? 0 : climb * 0.7))
        rot.multiply(pitch.setFromAxisAngle(forward, standing ? 0 : -Math.max(-0.7, Math.min(0.7, a.turn * 0.35))))
      } else {
        const walking = a.speed > 0.02
        // a stride is about 1.3 body lengths, so the legs go faster the faster it moves
        rate = walking ? (2 * Math.PI * a.speed) / (1.3 * Math.max(s, 0.01)) : 0
        moving = walking ? Math.min(1, 0.4 + a.speed / (a.species === 'deer' ? 5 : 4)) : 0
        third = a.head
        // lean with the ground: nose up going uphill, down going downhill
        const dx = Math.sin(a.heading) * 0.9
        const dz = Math.cos(a.heading) * 0.9
        const rise = sim.habitat.groundAt(a.x + dx, a.z + dz) - sim.habitat.groundAt(a.x - dx, a.z - dz)
        rot.multiply(pitch.setFromAxisAngle(right, Math.max(-0.5, Math.min(0.5, Math.atan2(rise, 1.8)))))
      }
      const phase = (phases.get(a) ?? a.id * 1.7) + rate * dt
      phases.set(a, phase % (Math.PI * 200))
      anim.setXYZW(k, phase, moving, third, a.species === 'deer' && a.id % 3 === 0 ? 1 : 0)

      mat.compose(pos.set(a.x, a.y, a.z), rot, scl.set(s, s, s))
      mesh.setMatrixAt(k, mat)
      // a little variation in coat tone; in "Show states" mode the state's colour instead
      const tone = 0.88 + 0.2 * ((a.id * 0.618) % 1)
      mesh.setColorAt(k, settings.showStates ? col.set(STATE_COLOR[a.state]) : col.setScalar(tone))

      if (coneMesh && settings.showStates && a.species === 'fox' && a.state !== 'leaving') {
        mat.compose(pos.set(a.x, a.y + 0.15, a.z), rot, scl.set(FOX.sight, 1, FOX.sight))
        coneMesh.setMatrixAt(coneCount++, mat)
      }
    }

    // footprints, shrinking away as they age
    const pm = prints.current
    if (pm) {
      let n = 0
      if (settings.tracks) {
        for (const t of sim.tracks) {
          const age = sim.time - t.t
          if (age > TRACK_LIFE) continue
          const size = sizeOf(t.species) * 0.07 * (1 - age / TRACK_LIFE)
          rot.setFromAxisAngle(up, t.heading)
          mat.compose(pos.set(t.x, t.y + 0.03, t.z), rot, scl.set(size * 0.55, 1, size))
          pm.setMatrixAt(n++, mat)
        }
      }
      pm.count = n
      pm.instanceMatrix.needsUpdate = true
    }

    for (const sp of SPECIES) {
      const mesh = meshes.current[sp]
      if (!mesh) continue
      mesh.count = filled[sp]
      anims[sp].needsUpdate = true
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
        ref={prints}
        args={[printGeometry, materials.print, 1600]}
        frustumCulled={false}
        raycast={() => null}
      />
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
