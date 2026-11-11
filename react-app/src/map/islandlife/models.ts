import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Vector3,
  type Texture,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { bakeClips, fillLight, type BakedModel } from '../wildlife/models'

/**
 * REAL MODELS FOR ISLAND LIFE, in public/models/:
 *
 *   PEOPLE    Quaternius's animated Man, Man in Suit, Woman and Woman in Dress
 *             (CC0, from poly.pizza). Their walk and idle animations are baked
 *             into vertex animation textures, as the deer and foxes are (see
 *             wildlife/models.ts), so a crowd of thousands is four draw calls.
 *   VEHICLES  Quaternius's Car, Sedan, SUV and Pickup Truck (CC0), and the Bus
 *             and Van by Poly by Google (CC-BY 3.0), all from poly.pizza. They
 *             don't move their parts, so each is one plain geometry, its
 *             materials' colours (or its palette texture's) baked into its
 *             vertices. The paint can be given a colour per vehicle.
 *
 * People are scaled to 1 unit tall, vehicles to 1 unit long, facing +z, on the
 * ground at y = 0.
 */

export type PersonClip = 'walk' | 'idle'
export type PersonModel = BakedModel<PersonClip>

export const PERSON_KEYS = ['man', 'manSuit', 'woman', 'womanDress'] as const
export type PersonKey = (typeof PERSON_KEYS)[number]

const PEOPLE: Record<PersonKey, { file: string; walk: string; idle: string }> = {
  man: { file: 'Man.glb', walk: 'HumanArmature|Man_Walk', idle: 'HumanArmature|Man_Idle' },
  manSuit: { file: 'ManSuit.glb', walk: 'HumanArmature|Man_Walk', idle: 'HumanArmature|Man_Idle' },
  woman: { file: 'Woman.glb', walk: 'HumanArmature|Female_Walk', idle: 'HumanArmature|Female_Idle' },
  womanDress: { file: 'WomanDress.glb', walk: 'HumanArmature|Female_Walk', idle: 'HumanArmature|Female_Idle' },
}

export const VEHICLE_KEYS = ['car', 'sedan', 'suv', 'pickup', 'van', 'bus'] as const
export type VehicleModelKey = (typeof VEHICLE_KEYS)[number]

const VEHICLES: Record<VehicleModelKey, string> = {
  car: 'Car.glb',
  sedan: 'Sedan.glb',
  suv: 'SUV.glb',
  pickup: 'Pickup.glb',
  van: 'Van.glb',
  bus: 'Bus.glb',
}

export interface VehicleModel {
  /** position, color (the model's own), aPaint (1 on the body, which takes the vehicle's colour). */
  geometry: BufferGeometry
}

export interface IslandModels {
  people: Record<PersonKey, PersonModel>
  vehicles: Record<VehicleModelKey, VehicleModel>
}

/** Room in each person model's mesh. */
export const PERSON_ROOM = 1600
/** Room in each vehicle model's mesh. */
export const VEHICLE_ROOM = 120

let loading: Promise<IslandModels> | null = null

/** Load and bake every model, once per page (later calls share the result). */
export function loadIslandModels(): Promise<IslandModels> {
  if (!loading) {
    loading = (async () => {
      const loader = new GLTFLoader()
      const url = (f: string) => `${import.meta.env.BASE_URL}models/${f}`
      const people = {} as Record<PersonKey, PersonModel>
      for (const key of PERSON_KEYS) {
        const src = PEOPLE[key]
        const gltf = await loader.loadAsync(url(src.file))
        const model = bakeClips<PersonClip>(gltf.scene, gltf.animations, { walk: src.walk, idle: src.idle }, {
          fps: { walk: 30, idle: 12 },
          room: PERSON_ROOM,
          rest: 'idle',
          gaits: ['walk'],
          fit: 'height',
        })
        markClothes(model, gltf.scene)
        people[key] = model
        await new Promise((r) => setTimeout(r)) // let a frame draw between models
      }
      const vehicles = {} as Record<VehicleModelKey, VehicleModel>
      for (const key of VEHICLE_KEYS) {
        const gltf = await loader.loadAsync(url(VEHICLES[key]))
        vehicles[key] = { geometry: flatten(gltf.scene) }
      }
      return { people, vehicles }
    })()
    loading.catch(() => (loading = null)) // a failed load can be tried again
  }
  return loading
}

/**
 * Mark a person's shirt or dress (aPaint = 1), so each person can wear their own
 * colour. The baked geometry keeps each material's colour in its vertices, so
 * the clothes are the vertices with the shirt's (or dress's) colour.
 */
function markClothes(model: PersonModel, root: Object3D) {
  const wear: number[][] = []
  root.traverse((o) => {
    const mat = (o as Mesh).material as MeshStandardMaterial | undefined
    if ((o as Mesh).isMesh && mat && /shirt|dress/i.test(mat.name)) wear.push(mat.color.toArray())
  })
  const col = model.geometry.getAttribute('color')
  const paint = new Float32Array(col.count)
  for (let i = 0; i < col.count; i++)
    for (const c of wear)
      if (Math.abs(col.getX(i) - c[0]) + Math.abs(col.getY(i) - c[1]) + Math.abs(col.getZ(i) - c[2]) < 1e-4) paint[i] = 1
  model.geometry.setAttribute('aPaint', new Float32BufferAttribute(paint, 1))
}

/** A texture's pixels, to read the colour under each vertex. */
function pixels(tex: Texture): { w: number; h: number; data: Uint8ClampedArray } | null {
  const img = tex.image as CanvasImageSource & { width: number; height: number }
  if (!img || !img.width) return null
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  return { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data }
}

/**
 * One geometry for a whole vehicle, in its world pose, with each vertex's colour
 * from its material (or the palette texture under it). The body is the colour
 * that covers the most surface; its vertices get aPaint = 1. The vehicle is
 * turned so its long side lies along z, its front (the headlights) toward +z.
 */
function flatten(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true)
  const parts: Mesh[] = []
  root.traverse((o) => {
    if ((o as Mesh).isMesh) parts.push(o as Mesh)
  })
  const pos: number[] = []
  const col: number[] = []
  const lights: number[] = [] // 1 for headlight vertices, to find the front
  const index: number[] = []
  const v = new Vector3()
  for (const p of parts) {
    const g = p.geometry
    const P = g.getAttribute('position')
    const UV = g.getAttribute('uv')
    const mat = p.material as MeshStandardMaterial
    const tex = mat.map ? pixels(mat.map) : null
    const base = pos.length / 3
    const headlight = /headlight/i.test(mat.name) ? 1 : 0
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(p.matrixWorld)
      pos.push(v.x, v.y, v.z)
      let r = mat.color.r
      let gg = mat.color.g
      let b = mat.color.b
      if (tex && UV) {
        const x = Math.min(tex.w - 1, Math.max(0, Math.floor((UV.getX(i) % 1) * tex.w)))
        const y = Math.min(tex.h - 1, Math.max(0, Math.floor((UV.getY(i) % 1) * tex.h)))
        const k = (y * tex.w + x) * 4
        // the texture is sRGB; the shader works in linear colour
        const lin = (c: number) => Math.pow(c / 255, 2.2)
        r *= lin(tex.data[k])
        gg *= lin(tex.data[k + 1])
        b *= lin(tex.data[k + 2])
      }
      col.push(r, gg, b)
      lights.push(headlight)
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) index.push(base + g.index.getX(i))
    else for (let i = 0; i < P.count; i++) index.push(base + i)
  }

  // the body: the colour with the most triangle area
  const area = new Map<string, number>()
  const keyOf = (i: number) => `${col[i * 3].toFixed(3)},${col[i * 3 + 1].toFixed(3)},${col[i * 3 + 2].toFixed(3)}`
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  for (let t = 0; t < index.length; t += 3) {
    const [i, j, k] = [index[t], index[t + 1], index[t + 2]]
    a.fromArray(pos, i * 3)
    b.fromArray(pos, j * 3).sub(a)
    c.fromArray(pos, k * 3).sub(a)
    const s = b.cross(c).length() / 2
    const key = keyOf(i)
    area.set(key, (area.get(key) ?? 0) + s)
  }
  let body = ''
  let most = -1
  for (const [key, s] of area) if (s > most) [body, most] = [key, s]
  const n = pos.length / 3
  const painted = new Float32Array(n)
  for (let i = 0; i < n; i++) painted[i] = keyOf(i) === body ? 1 : 0

  // measure, turn the long side onto z, and the front toward +z
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, pos[i * 3])
    maxX = Math.max(maxX, pos[i * 3])
    minY = Math.min(minY, pos[i * 3 + 1])
    minZ = Math.min(minZ, pos[i * 3 + 2])
    maxZ = Math.max(maxZ, pos[i * 3 + 2])
  }
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const sideways = maxX - minX > maxZ - minZ
  const len = Math.max(maxX - minX, maxZ - minZ)
  const out = new Float32Array(n * 3)
  let front = 0
  let lit = 0
  for (let i = 0; i < n; i++) {
    let x = (pos[i * 3] - cx) / len
    let z = (pos[i * 3 + 2] - cz) / len
    if (sideways) [x, z] = [-z, x]
    out[i * 3] = x
    out[i * 3 + 1] = (pos[i * 3 + 1] - minY) / len
    out[i * 3 + 2] = z
    if (lights[i]) {
      front += z
      lit++
    }
  }
  if (lit && front < 0)
    for (let i = 0; i < n; i++) {
      out[i * 3] *= -1
      out[i * 3 + 2] *= -1
    }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(out, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3))
  geometry.setAttribute('aPaint', new Float32BufferAttribute(painted, 1))
  geometry.setIndex(index)
  return geometry
}

/** A vehicle's material: the model's own colours, the body in each vehicle's paint (its instance colour). */
export function vehicleMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, vertexColors: true, flatShading: true })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = { value: 0.25 } // see modelMaterials: a little light of its own
    shader.fragmentShader = fillLight(shader.fragmentShader)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPaint;')
      .replace(
        '#include <color_vertex>',
        /* glsl */ `
#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
// color_vertex multiplied the whole vehicle by its paint: only the body takes it
vColor.xyz = mix(color.xyz, instanceColor.xyz, aPaint);
#endif
`,
      )
  }
  return mat
}
