import {
  AnimationClip,
  AnimationMixer,
  BufferGeometry,
  DataTexture,
  DataUtils,
  Float32BufferAttribute,
  HalfFloatType,
  InstancedBufferAttribute,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  Object3D,
  RGBADepthPacking,
  RGBAFormat,
  type IUniform,
  type SkinnedMesh,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * REAL ANIMAL MODELS for the deer and foxes: Quaternius's low-poly Deer, Stag and
 * Fox (CC0, from poly.pizza), in public/models/. Each comes rigged, with
 * hand-made animations: walk, gallop, idle, grazing, head low.
 *
 * A rigged model is normally animated on the CPU, one skeleton per animal, and
 * three.js can't instance it. Instead, when the page loads, each animation is
 * played once and every vertex's position is recorded, frame by frame, into a
 * texture (a "vertex animation texture"). The GPU then reads each animal's pose
 * from that texture, so the whole herd is still one draw call per model, and
 * each animal can be at its own point in its own clip.
 *
 * The bodies are scaled to the same convention as shapes.ts: 1 unit long, facing
 * +z, feet at y = 0.
 */

export type ModelKey = 'doe' | 'stag' | 'fox'
/** What the animal is doing, as far as its animation goes. */
export type Clip = 'idle' | 'rest' | 'eat' | 'walk' | 'gallop'
export const CLIPS: Clip[] = ['idle', 'rest', 'eat', 'walk', 'gallop']

const DEER_CLIPS: Record<Clip, string> = {
  idle: 'Idle',
  rest: 'Idle_Headlow',
  eat: 'Eating',
  walk: 'Walk',
  gallop: 'Gallop',
}
const SOURCES: Record<ModelKey, { file: string; clips: Record<Clip, string> }> = {
  doe: { file: 'Deer.glb', clips: DEER_CLIPS },
  stag: { file: 'Stag.glb', clips: DEER_CLIPS },
  fox: {
    file: 'Fox.glb',
    clips: { idle: 'Idle', rest: 'Idle_2_HeadLow', eat: 'Eating', walk: 'Walk', gallop: 'Gallop' },
  },
}

/** Frames recorded per second of each clip: the quick gaits need more to stay smooth. */
const FPS: Record<Clip, number> = { idle: 12, rest: 12, eat: 12, walk: 30, gallop: 40 }
/** Long clips are cut to this (the stag grazes for 12 s), to keep the textures small. */
const MAX_SECONDS = 6
const TEX_WIDTH = 4096
/** Room in each model's mesh (Wildlife.tsx's ROOM for the species). */
const ROOM: Record<ModelKey, number> = { doe: 300, stag: 300, fox: 60 }

export interface ClipInfo {
  /** Where the clip's frames start in the texture, and how many there are. */
  start: number
  frames: number
  /** Seconds, for clips that play at their own pace. */
  duration: number
  /**
   * For the gaits: how far the animal travels in one cycle, in body lengths
   * (measured from how far a hoof sweeps back while it's on the ground). The
   * clip is played at the rate that keeps that hoof planted.
   */
  stride: number
}

export interface AnimalModel {
  geometry: BufferGeometry
  texture: DataTexture
  vertices: number
  clips: Record<Clip, ClipInfo>
  /** Per animal: the clip it's fading out of, and the clip it's in (see VAT_VERT). */
  clipFrom: InstancedBufferAttribute
  clipTo: InstancedBufferAttribute
}

let loading: Promise<Record<ModelKey, AnimalModel>> | null = null

/** Load and bake all three models, once per page (later calls share the result). */
export function loadAnimalModels(): Promise<Record<ModelKey, AnimalModel>> {
  if (!loading) {
    loading = (async () => {
      const loader = new GLTFLoader()
      const out = {} as Record<ModelKey, AnimalModel>
      for (const key of Object.keys(SOURCES) as ModelKey[]) {
        const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${SOURCES[key].file}`)
        out[key] = bake(gltf.scene, gltf.animations, SOURCES[key].clips, ROOM[key])
        await new Promise((r) => setTimeout(r)) // let a frame draw between models
      }
      return out
    })()
    loading.catch(() => (loading = null)) // a failed load can be tried again
  }
  return loading
}

function bake(root: Object3D, animations: AnimationClip[], names: Record<Clip, string>, room: number): AnimalModel {
  root.updateMatrixWorld(true)
  // the skinned body, plus any rigid parts carried on a bone (the stag's antlers)
  const parts: Mesh[] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh) parts.push(o as Mesh)
  })

  // one geometry for the whole animal: each part's material colour baked into its vertices
  let vertices = 0
  for (const p of parts) vertices += p.geometry.getAttribute('position').count
  const color = new Float32Array(vertices * 3)
  const vid = new Float32Array(vertices)
  const index: number[] = []
  let off = 0
  for (const p of parts) {
    const n = p.geometry.getAttribute('position').count
    const c = (p.material as MeshStandardMaterial).color
    for (let i = 0; i < n; i++) {
      color.set([c.r, c.g, c.b], (off + i) * 3)
      vid[off + i] = off + i
    }
    const idx = p.geometry.index
    if (idx) for (let i = 0; i < idx.count; i++) index.push(off + idx.getX(i))
    else for (let i = 0; i < n; i++) index.push(off + i)
    off += n
  }

  // play each clip and record every vertex, frame by frame
  const mixer = new AnimationMixer(root)
  const frames: Float32Array[] = []
  const clips = {} as Record<Clip, ClipInfo>
  const bone = new Matrix4()
  const toWorld: Matrix4[] = []
  for (const clip of CLIPS) {
    const anim = animations.find((a) => a.name === names[clip])
    if (!anim) throw new Error(`animal model has no "${names[clip]}" animation`)
    const duration = Math.min(anim.duration, MAX_SECONDS)
    const n = Math.max(2, Math.round(duration * FPS[clip]))
    clips[clip] = { start: frames.length, frames: n, duration, stride: 1 }
    const action = mixer.clipAction(anim)
    action.play()
    for (let f = 0; f < n; f++) {
      action.time = (f / n) * duration
      mixer.update(0)
      root.updateMatrixWorld(true)
      const pos = new Float32Array(vertices * 3)
      let o = 0
      for (const p of parts) {
        if ((p as SkinnedMesh).isSkinnedMesh) {
          // each bone's full transform, from the bind pose to where it is now, in world space
          const sk = (p as SkinnedMesh).skeleton
          toWorld.length = sk.bones.length
          for (let b = 0; b < sk.bones.length; b++) {
            toWorld[b] = (toWorld[b] ?? new Matrix4())
              .copy(p.matrixWorld)
              .multiply((p as SkinnedMesh).bindMatrixInverse)
              .multiply(bone.multiplyMatrices(sk.bones[b].matrixWorld, sk.boneInverses[b]))
              .multiply((p as SkinnedMesh).bindMatrix)
          }
          skin(p as SkinnedMesh, toWorld, pos, o)
        } else {
          // a rigid part simply moves with whatever it hangs from
          const g = p.geometry.getAttribute('position')
          const e = p.matrixWorld.elements
          for (let i = 0; i < g.count; i++) {
            const x = g.getX(i)
            const y = g.getY(i)
            const z = g.getZ(i)
            pos.set(
              [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]],
              (o + i) * 3,
            )
          }
        }
        o += p.geometry.getAttribute('position').count
      }
      frames.push(pos)
    }
    action.stop()
  }
  mixer.uncacheRoot(root)

  // scale to 1 unit long, centred, feet on the ground (from the first idle frame)
  const rest = frames[clips.idle.start]
  let minY = Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < vertices; i++) {
    minY = Math.min(minY, rest[i * 3 + 1])
    minZ = Math.min(minZ, rest[i * 3 + 2])
    maxZ = Math.max(maxZ, rest[i * 3 + 2])
  }
  const k = 1 / (maxZ - minZ)
  const midZ = (minZ + maxZ) / 2
  for (const fr of frames) {
    for (let i = 0; i < vertices; i++) {
      fr[i * 3] *= k
      fr[i * 3 + 1] = (fr[i * 3 + 1] - minY) * k
      fr[i * 3 + 2] = (fr[i * 3 + 2] - midZ) * k
    }
  }

  // the gaits' stride: how far the lowest hoof sweeps fore and aft over the cycle
  for (const clip of ['walk', 'gallop'] as Clip[]) {
    const c = clips[clip]
    const first = frames[c.start]
    let hoof = 0
    for (let i = 1; i < vertices; i++) if (first[i * 3 + 1] < first[hoof * 3 + 1]) hoof = i
    let lo = Infinity
    let hi = -Infinity
    for (let f = 0; f < c.frames; f++) {
      const z = frames[c.start + f][hoof * 3 + 2]
      lo = Math.min(lo, z)
      hi = Math.max(hi, z)
    }
    // a galloping animal also flies between footfalls, so it covers more ground than the sweep
    c.stride = Math.min(2, Math.max(0.15, (hi - lo) * (clip === 'gallop' ? 1.5 : 1)))
  }

  // every frame into one half-float texture, a row of vertices at a time, wrapping
  const texels = frames.length * vertices
  const height = Math.ceil(texels / TEX_WIDTH)
  const data = new Uint16Array(TEX_WIDTH * height * 4)
  frames.forEach((fr, f) => {
    for (let i = 0; i < vertices; i++) {
      const t = (f * vertices + i) * 4
      data[t] = DataUtils.toHalfFloat(fr[i * 3])
      data[t + 1] = DataUtils.toHalfFloat(fr[i * 3 + 1])
      data[t + 2] = DataUtils.toHalfFloat(fr[i * 3 + 2])
      data[t + 3] = DataUtils.toHalfFloat(1)
    }
  })
  const texture = new DataTexture(data, TEX_WIDTH, height, RGBAFormat, HalfFloatType)
  texture.needsUpdate = true

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(rest, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3))
  geometry.setAttribute('aVid', new Float32BufferAttribute(vid, 1))
  geometry.setIndex(index)
  const clipFrom = new InstancedBufferAttribute(new Float32Array(room * 4), 4)
  const clipTo = new InstancedBufferAttribute(new Float32Array(room * 4), 4)
  geometry.setAttribute('aClipFrom', clipFrom)
  geometry.setAttribute('aClipTo', clipTo)
  return { geometry, texture, vertices, clips, clipFrom, clipTo }
}

/** Linear-blend skinning of one part's vertices into `out`, starting at vertex `offset`. */
function skin(p: SkinnedMesh, bones: Matrix4[], out: Float32Array, offset: number) {
  const g = p.geometry
  const pos = g.getAttribute('position')
  const si = g.getAttribute('skinIndex')
  const sw = g.getAttribute('skinWeight')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    let ox = 0
    let oy = 0
    let oz = 0
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j)
      if (w === 0) continue
      const e = bones[si.getComponent(i, j)].elements
      ox += w * (e[0] * x + e[4] * y + e[8] * z + e[12])
      oy += w * (e[1] * x + e[5] * y + e[9] * z + e[13])
      oz += w * (e[2] * x + e[6] * y + e[10] * z + e[14])
    }
    out.set([ox, oy, oz], (offset + i) * 3)
  }
}

// --- drawing: the GPU looks up each vertex's position in the animal's clips ---------
const VAT_HEADER = /* glsl */ `
attribute float aVid;
attribute vec4 aClipFrom;  // first frame, frame count, how far through (0–1), how far faded to aClipTo
attribute vec4 aClipTo;    // first frame, frame count, how far through (0–1)
uniform sampler2D uVat;
uniform int uVerts;
uniform float uStates;
vec3 vatFrame(float frame) {
  int i = int(frame) * uVerts + int(aVid);
  int w = textureSize(uVat, 0).x;
  return texelFetch(uVat, ivec2(i % w, i / w), 0).xyz;
}
// a point in a looping clip, blended between the two nearest recorded frames
vec3 vatClip(vec4 c) {
  float x = fract(c.z) * c.y;
  float f = floor(x);
  return mix(vatFrame(c.x + f), vatFrame(c.x + mod(f + 1.0, c.y)), x - f);
}
`
const VAT_VERT = /* glsl */ `
#include <begin_vertex>
transformed = mix(vatClip(aClipFrom), vatClip(aClipTo), aClipFrom.w);
`
const VAT_COLOR = /* glsl */ `
#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.xyz = mix(vColor.xyz, instanceColor.xyz, uStates);
#endif
`

/**
 * The material for one model, and the matching one for its shadow. Flat shading
 * gives the low-poly facets without baking normals for every frame.
 */
export function modelMaterials(model: AnimalModel, uStates: IUniform<number>) {
  const uniforms = { uVat: { value: model.texture }, uVerts: { value: model.vertices }, uStates }
  const inject = (shader: WebGLProgramParametersWithUniforms, color: boolean) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VAT_HEADER}`)
      .replace('#include <begin_vertex>', VAT_VERT)
    if (color) shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', VAT_COLOR)
  }
  const body = new MeshStandardMaterial({ roughness: 0.85, vertexColors: true, flatShading: true })
  body.onBeforeCompile = (s) => inject(s, true)
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
  depth.onBeforeCompile = (s) => inject(s, false)
  return { body, depth }
}
