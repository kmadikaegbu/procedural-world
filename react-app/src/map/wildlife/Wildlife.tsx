import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { setActiveSim } from './active'
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
import { loadAnimalModels, modelMaterials, type AnimalModel, type Clip, type ModelKey } from './models'
import {
  envFrom,
  FOX,
  REAL_LENGTH,
  SPECIES,
  TRACK_LIFE,
  WildlifeSim,
  type Agent,
  type Species,
  type WildlifeStats,
} from './sim'
import type { Season } from '../trees/seasons'
import { WEATHER_DEFAULTS, type WeatherParams } from '../../weather/presets'
import type { WildlifeSettings } from './settings'

/**
 * Animals nearer the camera than this (world units) are drawn at their true size
 * next to the trees; farther away they grow with distance, so they stay visible.
 */
const NEAR_VIEW = 25

/** Room in each species' mesh: the slider maximum, twice over for newborns and leavers. */
const ROOM: Record<Species, number> = { bird: 600, deer: 300, fox: 60 }
/** Longest step the simulation takes, so a slow frame can't fling animals across the map. */
const MAX_DT = 0.05

// --- animation, done in the vertex shader -------------------------------------------
// A small skeleton, driven by hand. Each leg is three rigid pieces (upper leg,
// lower leg, foot) that the shader swings about the hip, knee and ankle, so a leg
// bends like a real one instead of shearing. The neck bends about the withers, the
// tail about its root. Gaits come from how each leg's stride is timed:
//   stand      breathing, a swishing tail, the head turning to look about
//   walk       a four-beat gait, each leg after the one before; the foot is
//              planted while the body moves over it, then swings forward
//   trot       diagonal pairs of legs together, a shorter ground contact
//   gallop     the front pair and the back pair bound, the spine rocking
//   graze/eat  the neck bends the head down; it chews
//   lie        the legs fold at hip and knee and the body settles
// The pieces' weights and joints are painted on the vertices (shapes.ts).
const ANIM_HEADER = /* glsl */ `
attribute vec4 aPart;     // (unused), which leg, head-follow, wing-flap weights
attribute float aFlag;    // 1 on antlers, 2 on the tail
attribute vec4 aPiv;      // hip, knee (height, z); or the neck's / tail's pivot
attribute vec3 aPiv2;     // leg piece (0 body, 1 upper, 2 lower, 3 foot), ankle (height, z)
attribute vec4 aAnim;     // stride phase, moving, head down / wings folded, antlers
attribute vec4 aPose;     // tail raised, lying down, how far the body drops when lying, a per-animal seed
attribute vec2 aMove;     // gait (0 walk, 1 trot, 2 gallop; -1 for a bird), how much it looks around
uniform float uStates;
uniform float uTime;
// rotate p = (height, forward) about pv by angle a (positive swings the lower end backward / the head down)
vec2 rotYZ(vec2 p, vec2 pv, float a) {
  vec2 r = p - pv;
  float c = cos(a);
  float s = sin(a);
  return pv + vec2(r.x * c - r.y * s, r.x * s + r.y * c);
}
`
const ANIM_VERT = /* glsl */ `
#include <begin_vertex>
float seed = aPose.w;
float bird = step(aMove.x, -0.5);
float gait = max(aMove.x, 0.0);
float g1 = clamp(gait, 0.0, 1.0);                 // walk → trot
float g2 = clamp(gait - 1.0, 0.0, 1.0);           // trot → gallop
float stride = aAnim.y;
float lie = aPose.y;
float seg = aPiv2.x;
vec2 p = transformed.yz;                          // (height, forward)

// --- legs
if (seg > 0.5) {
  // when each leg steps, as a fraction of the stride cycle
  vec4 oWalk = vec4(0.0, 0.5, 0.75, 0.25);
  vec4 oTrot = vec4(0.0, 0.5, 0.5, 0.0);
  vec4 oGallop = vec4(0.0, 0.1, 0.5, 0.6);
  vec4 offs = gait < 1.0 ? mix(oWalk, oTrot, gait) : mix(oTrot, oGallop, g2);
  float cyc = fract(aAnim.x / 6.2832 + offs[int(aPart.y + 0.5)]);
  float down = mix(mix(0.62, 0.5, g1), 0.38, g2);       // the share of the cycle the foot is on the ground
  float reach = mix(mix(0.32, 0.5, g1), 0.8, g2);       // how far the leg swings fore and aft
  float bend = mix(mix(0.9, 1.25, g1), 1.6, g2);        // how far the knee folds in the swing
  float fwd;
  float flex;
  if (cyc < down) {
    // on the ground: the leg sweeps back at a steady pace, so the foot doesn't slide
    float q = cyc / down;
    fwd = reach * (1.0 - 2.0 * q);
    flex = 0.15 * sin(q * 3.1416);
  } else {
    // in the air: the knee folds, the foot comes forward and reaches out
    float q = (cyc - down) / (1.0 - down);
    float e = q * q * (3.0 - 2.0 * q);
    fwd = reach * (-1.0 + 2.0 * e);
    flex = bend * sin(q * 3.1416);
  }
  float hip = -fwd * stride;
  float knee = flex * stride;
  float ankle = -0.7 * (hip + knee);
  // lying down: the legs fold under the body (front legs forward, hind legs tucked)
  float frontLeg = 1.0 - step(1.5, aPart.y);
  hip = mix(hip, mix(-1.5, -0.9, frontLeg), lie);
  knee = mix(knee, mix(2.3, 2.3, frontLeg), lie);
  ankle = mix(ankle, -0.5, lie);
  if (seg > 2.5) p = rotYZ(p, aPiv2.yz, ankle);
  if (seg > 1.5) p = rotYZ(p, aPiv.zw, knee);
  p = rotYZ(p, aPiv.xy, hip);
}

// --- neck and head: bend about the withers, a little more toward the head
if (aPart.z > 0.0 && aFlag < 1.5) {
  float nod = sin(aAnim.x * 2.0) * 0.05 * stride;     // the head nods as it walks
  p = rotYZ(p, aPiv.xy, (aAnim.z * 0.6 + nod) * aPart.z);
  p.x -= aPart.z * max(aAnim.z, 0.0) * 0.2;            // and the shoulders sink to reach the ground
  p.x += aPart.z * step(0.5, aAnim.z) * sin(uTime * 9.0 + seed) * 0.005;   // chewing
}

// --- the tail swishes, and swings up to flash its white underside when the deer is alarmed
if (aFlag > 1.5) {
  float ang = aPose.x * 1.25 + sin(uTime * 2.6 + seed) * 0.1 * (1.0 - aPose.x);
  p = rotYZ(p, aPiv.xy, ang);
}

// --- the whole body: it rocks with the gait (a rocking-horse bound at the gallop)
float pitchBody = g2 * stride * 0.09 * sin(aAnim.x + 0.5) + g1 * stride * 0.02 * sin(aAnim.x);
p = rotYZ(p, vec2(0.4, 0.0), pitchBody * (1.0 - bird));
p.x += (abs(sin(aAnim.x)) * 0.012 * (1.0 - g2) + g2 * sin(aAnim.x) * 0.04) * stride * (1.0 - bird);
// breathing while it stands
p.x += sin(uTime * 2.1 + seed) * 0.004 * (1.0 - stride) * (1.0 - bird);
transformed.yz = p;

// the head turns to look about while it stands
float yaw = aMove.y * sin(uTime * 0.7 + seed) * 0.55 * aPart.z * (1.0 - stride);
vec2 pv = transformed.xz - vec2(0.0, aPiv.y);
transformed.xz = vec2(0.0, aPiv.y) + vec2(pv.x * cos(yaw) + pv.y * sin(yaw), -pv.x * sin(yaw) + pv.y * cos(yaw));

// lying down: the whole body settles to the ground
transformed.y -= lie * aPose.z;

// --- a bird: wings folded when it has landed, otherwise beating, the tips lagging the shoulders
float fold = clamp(aAnim.z, 0.0, 1.0) * step(0.001, aPart.w);
float wingW = aPart.w;
transformed.x *= mix(1.0, 0.16, fold);
transformed.y += fold * 0.04;
transformed.y += wingW * (sin(aAnim.x - 1.1 * wingW) * 0.32 * aAnim.y + 0.02) * (1.0 - fold);
transformed.x *= 1.0 - 0.14 * aAnim.y * wingW * (0.5 - 0.5 * cos(aAnim.x - 1.1 * wingW)) * (1.0 - fold);
transformed.z -= wingW * (cos(aAnim.x - 1.1 * wingW) * 0.04 * aAnim.y);
transformed.y += bird * sin(aAnim.x + 0.6) * 0.012 * aAnim.y * (1.0 - wingW);

// antlers exist only on some deer
transformed *= mix(1.0, aAnim.w, step(0.5, aFlag) * step(aFlag, 1.5));
`
const ANIM_COLOR = /* glsl */ `
#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = mix(vColor.xyz, instanceColor.xyz, uStates);
#endif
`

function animalMaterial(uStates: IUniform<number>, uTime: IUniform<number>): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.85, side: DoubleSide, vertexColors: true })
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uStates = uStates
    shader.uniforms.uTime = uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ANIM_HEADER}`)
      .replace('#include <begin_vertex>', ANIM_VERT)
      .replace('#include <color_vertex>', ANIM_COLOR)
  }
  return mat
}

/**
 * Seasonal coats, as a tint over the painted colours: deer are reddish-brown in
 * summer and a duller grey-brown in winter; a fox's winter coat is fuller and paler.
 */
const COAT: Record<Species, Record<Season, [number, number, number]>> = {
  bird: { spring: [1, 1, 1], summer: [1, 1, 1], autumn: [1, 1, 1], winter: [1, 1, 1] },
  deer: {
    spring: [1, 0.97, 0.93],
    summer: [1.08, 0.96, 0.86],
    autumn: [0.97, 0.93, 0.88],
    winter: [0.84, 0.88, 0.94],
  },
  fox: {
    spring: [1, 1, 1],
    summer: [1, 1, 1],
    autumn: [1.02, 1, 0.97],
    winter: [1.08, 1.08, 1.05],
  },
}

/** How far the body sinks when an animal lies down (in its own units; the birds never do). */
/** Leg length, in the animal's own units: how far a swing of the hip moves the foot. */
const LEG_LENGTH: Record<Species, number> = { bird: 0.1, deer: 0.49, fox: 0.26 }

const DROP: Record<Species, number> = { bird: 0, deer: 0.33, fox: 0.19 }

const MODEL_KEYS: ModelKey[] = ['doe', 'stag', 'fox']
const MODEL_SPECIES: Record<ModelKey, Species> = { doe: 'deer', stag: 'deer', fox: 'fox' }
/** Seconds to cross-fade from one clip to the next, so a deer doesn't snap from grazing to running. */
const CLIP_FADE = 0.3

/** Only grown bucks carry antlers. */
const antlered = (a: Agent) => a.species === 'deer' && a.id % 3 === 0 && a.age > 0.9

/** Which of the model's clips fits what the animal is doing. */
function clipFor(a: Agent): Clip {
  if (a.head > 0.5) return 'eat' // grazing, drinking, or a fox at its catch
  if (a.speed > 0.05) return gaitFor(a.speed) >= 1 ? 'gallop' : 'walk'
  if (a.lie > 0.5 || a.state === 'rest') return 'rest'
  return 'idle'
}

/** Each animal's place in its animation: the clip it's in, and the one it's fading out of. */
interface ClipState {
  clip: Clip
  t: number
  prev: Clip
  prevT: number
  fade: number
}

/** 0 walk … 1 trot … 2 gallop, from how fast it is moving. */
function gaitFor(speed: number): number {
  if (speed < 1.4) return 0
  if (speed < 3) return (speed - 1.4) / 1.6
  if (speed < 4) return 1
  return 1 + Math.min(1, (speed - 4) / 1.2)
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
  // let the follow camera find the animals (active.ts)
  useEffect(() => {
    setActiveSim(sim)
    return () => setActiveSim(null)
  }, [sim])
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
    const time: IUniform<number> = { value: 0 }
    const body = animalMaterial(states, time)
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
    return { body, cone, states, time, print }
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
      BODIES[sp].setAttribute('aPose', new InstancedBufferAttribute(new Float32Array(ROOM[sp] * 4), 4))
      BODIES[sp].setAttribute('aMove', new InstancedBufferAttribute(new Float32Array(ROOM[sp] * 2), 2))
    }
    return out
  }, [])
  // the real deer and fox models (models.ts); until they've loaded, or if they can't
  // be, the deer and foxes are drawn with the built-in bodies instead
  const [models, setModels] = useState<Record<ModelKey, AnimalModel> | null>(null)
  useEffect(() => {
    let live = true
    loadAnimalModels()
      .then((m) => live && setModels(m))
      .catch((err) => console.warn('Animal models failed to load; using the built-in bodies.', err))
    return () => {
      live = false
    }
  }, [])
  const modelMats = useMemo(() => {
    if (!models) return null
    const out = {} as Record<ModelKey, ReturnType<typeof modelMaterials>>
    for (const key of MODEL_KEYS) out[key] = modelMaterials(models[key], materials.states)
    return out
  }, [models, materials])
  useEffect(
    () => () => {
      if (modelMats) for (const key of MODEL_KEYS) {
        modelMats[key].body.dispose()
        modelMats[key].depth.dispose()
      }
    },
    [modelMats],
  )
  const modelMeshes = useRef<Partial<Record<ModelKey, InstancedMesh | null>>>({})
  const clipStates = useMemo(() => new WeakMap<object, ClipState>(), [])

  // each animal's stride/flap phase, kept as it moves so a change of speed doesn't jerk the legs
  const phases = useMemo(() => new WeakMap<object, number>(), [])
  const flashes = useMemo(() => new WeakMap<object, number>(), [])
  // where the camera is, for the distance enlargement (see draw)
  const viewer = useRef(new Vector3())
  const coneGeometry = useMemo(() => visionCone(FOX.fov), [])
  // a hoof or paw print: a small flat oval
  const printGeometry = useMemo(() => new CircleGeometry(1, 8).rotateX(-Math.PI / 2), [])
  useEffect(() => () => printGeometry.dispose(), [printGeometry])
  useEffect(() => () => coneGeometry.dispose(), [coneGeometry])

  useFrame((state, delta) => {
    // the sea and the city move with the timeline: re-decide what's wild when they do
    const key = `${params.seaLevel.toFixed(2)}|${cityReach.toFixed(0)}|${paving.toFixed(2)}`
    if (key !== habitatKey.current) {
      habitatKey.current = key
      sim.habitat.update(params.seaLevel, cityReach, paving)
    }
    materials.time.value = state.clock.elapsedTime
    viewer.current.copy(state.camera.position)
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
    // The animals are drawn on the same ruler as the trees (real length × the scale's
    // objects factor), so up close a deer is the right size next to a tree. A deer that
    // size is a speck from the camera's usual distance, so it is also enlarged with
    // distance (like a map symbol): by distance ÷ NEAR, up to the Size slider's limit.
    const sizeOf = (sp: Species) => m(REAL_LENGTH[sp]) * EXAGGERATION[scaleMode].objects
    const view = viewer.current
    const boostAt = (x: number, y: number, z: number) =>
      Math.min(settings.size, Math.max(1, Math.hypot(x - view.x, y - view.y, z - view.z) / NEAR_VIEW))
    const filled: Record<Species, number> = { bird: 0, deer: 0, fox: 0 }
    const modelFilled: Record<ModelKey, number> = { doe: 0, stag: 0, fox: 0 }
    let coneCount = 0
    const coneMesh = cones.current

    // fawns are smaller than grown deer
    const drawnSize = (a: Agent) =>
      sizeOf(a.species) *
      boostAt(a.x, a.y, a.z) *
      Math.max(0, a.grow) *
      (a.species === 'deer' ? 0.55 + 0.45 * a.age : 1)
    // lean with the ground: nose up going uphill, down going downhill
    const lean = (a: Agent) => {
      const dx = Math.sin(a.heading) * 0.9
      const dz = Math.cos(a.heading) * 0.9
      const rise = sim.habitat.groundAt(a.x + dx, a.z + dz) - sim.habitat.groundAt(a.x - dx, a.z - dz)
      rot.multiply(pitch.setFromAxisAngle(right, Math.max(-0.5, Math.min(0.5, Math.atan2(rise, 1.8)))))
    }
    // a little variation in coat tone; in "Show states" mode the state's colour instead
    const colour = (mesh: InstancedMesh, k: number, a: Agent) => {
      const tone = 0.88 + 0.2 * ((a.id * 0.618) % 1)
      const coat = COAT[a.species][season]
      mesh.setColorAt(
        k,
        settings.showStates ? col.set(STATE_COLOR[a.state]) : col.setRGB(tone * coat[0], tone * coat[1], tone * coat[2]),
      )
    }
    const aimCone = (a: Agent) => {
      if (coneMesh && settings.showStates && a.species === 'fox' && a.state !== 'leaving') {
        mat.compose(pos.set(a.x, a.y + 0.15, a.z), rot, scl.set(FOX.sight, 1, FOX.sight))
        coneMesh.setMatrixAt(coneCount++, mat)
      }
    }

    // a deer or fox drawn with its real model: pick the clip for what it's doing, and
    // play it at the pace that keeps its hooves planted
    const drawModel = (a: Agent, key: ModelKey, model: AnimalModel) => {
      const mesh = modelMeshes.current[key]
      const k = modelFilled[key]
      if (!mesh || k >= ROOM[a.species]) return
      modelFilled[key]++
      const s = drawnSize(a)
      const rateOf = (clip: Clip) => {
        const c = model.clips[clip]
        return clip === 'walk' || clip === 'gallop' ? a.speed / (c.stride * Math.max(s, 0.01)) : 1 / c.duration
      }
      const want = clipFor(a)
      let c = clipStates.get(a)
      if (!c) {
        // start each animal at its own point in the clip, so a herd doesn't move in step
        c = { clip: want, t: (a.id * 0.37) % 1, prev: want, prevT: 0, fade: 1 }
        clipStates.set(a, c)
      }
      if (want !== c.clip) {
        const gaits = (x: Clip) => x === 'walk' || x === 'gallop'
        c.prev = c.clip
        c.prevT = c.t
        c.t = gaits(want) && gaits(c.clip) ? c.t : 0 // walk ↔ gallop keeps the legs' timing
        c.clip = want
        c.fade = 0
      }
      c.t = (c.t + rateOf(c.clip) * dt) % 1
      c.prevT = (c.prevT + rateOf(c.prev) * dt) % 1
      c.fade = Math.min(1, c.fade + dt / CLIP_FADE)
      const from = model.clips[c.prev]
      const to = model.clips[c.clip]
      model.clipFrom.setXYZW(k, from.start, from.frames, c.prevT, c.fade)
      model.clipTo.setXYZW(k, to.start, to.frames, c.t, 0)

      rot.setFromAxisAngle(up, a.heading)
      lean(a)
      mat.compose(pos.set(a.x, a.y, a.z), rot, scl.set(s, s, s))
      mesh.setMatrixAt(k, mat)
      colour(mesh, k, a)
      aimCone(a)
    }

    for (const a of sim.agents) {
      if (models && a.species !== 'bird') {
        const key: ModelKey = a.species === 'fox' ? 'fox' : antlered(a) ? 'stag' : 'doe'
        drawModel(a, key, models[key])
        continue
      }
      const mesh = meshes.current[a.species]
      const k = filled[a.species]
      if (!mesh || k >= ROOM[a.species]) continue
      filled[a.species]++

      const s = drawnSize(a)
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
        // the legs cycle at the rate that keeps the planted foot still on the ground: the
        // ground covered in one cycle is the leg's sweep (reach × leg length × 2), and
        // at a gallop the animal also flies a little between footfalls
        const g = gaitFor(a.speed)
        const reach = g < 1 ? 0.32 + 0.18 * g : 0.5 + 0.3 * (g - 1)
        const strideLen = 2 * reach * LEG_LENGTH[a.species] * (1 + 0.6 * Math.max(0, g - 1))
        rate = walking ? (2 * Math.PI * a.speed) / (strideLen * Math.max(s, 0.01)) : 0
        moving = walking ? Math.min(1, 0.4 + a.speed / (a.species === 'deer' ? 5 : 4)) : 0
        third = a.head
        lean(a)
      }
      const phase = (phases.get(a) ?? a.id * 1.7) + rate * dt
      phases.set(a, phase % (Math.PI * 200))
      anim.setXYZW(k, phase, moving, third, antlered(a) ? 1 : 0)
      // pose: tail flash (deer), how far it is lying down, a seed so no two idle alike
      const flashTarget = a.species === 'deer' && (a.state === 'flee' || a.alert > 0.5) ? 1 : 0
      const flashed = (flashes.get(a) ?? 0) + (flashTarget - (flashes.get(a) ?? 0)) * Math.min(1, dt * 6)
      flashes.set(a, flashed)
      const pose = BODIES[a.species].getAttribute('aPose') as InstancedBufferAttribute
      pose.setXYZW(k, flashed, a.lie, DROP[a.species], a.id * 0.7)
      // gait from speed, and how much it looks about (more when it is still and unthreatened)
      const look =
        a.state === 'alert' ? 0.1 : a.state === 'rest' ? 0.7 : a.mode === 2 && a.state === 'graze' ? 1 : a.speed < 0.05 ? 0.35 : 0.1
      const move = BODIES[a.species].getAttribute('aMove') as InstancedBufferAttribute
      move.setXY(k, a.species === 'bird' ? -1 : gaitFor(a.speed), look)

      mat.compose(pos.set(a.x, a.y, a.z), rot, scl.set(s, s, s))
      mesh.setMatrixAt(k, mat)
      colour(mesh, k, a)
      aimCone(a)
    }

    // footprints, shrinking away as they age
    const pm = prints.current
    if (pm) {
      let n = 0
      if (settings.tracks) {
        for (const t of sim.tracks) {
          const age = sim.time - t.t
          if (age > TRACK_LIFE) continue
          const size = sizeOf(t.species) * boostAt(t.x, t.y, t.z) * 0.07 * (1 - age / TRACK_LIFE)
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
      ;(BODIES[sp].getAttribute('aPose') as InstancedBufferAttribute).needsUpdate = true
      ;(BODIES[sp].getAttribute('aMove') as InstancedBufferAttribute).needsUpdate = true
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    if (models) {
      for (const key of MODEL_KEYS) {
        const mesh = modelMeshes.current[key]
        if (!mesh) continue
        mesh.count = modelFilled[key]
        models[key].clipFrom.needsUpdate = true
        models[key].clipTo.needsUpdate = true
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
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
      {models &&
        modelMats &&
        MODEL_KEYS.map((key) => (
          <instancedMesh
            key={key}
            ref={(mesh) => {
              modelMeshes.current[key] = mesh
            }}
            args={[models[key].geometry, modelMats[key].body, ROOM[MODEL_SPECIES[key]]]}
            customDepthMaterial={modelMats[key].depth}
            castShadow
            frustumCulled={false}
            raycast={() => null}
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
