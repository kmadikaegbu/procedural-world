import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DataUtils,
  Group,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  SRGBColorSpace,
  Vector3,
  type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three'
import { height, shapeKey, type TerrainParams } from '../noise'
import { WORLD } from '../world/shore'
import type { ScaleMode } from '../scale'
import { BUILDING_EXAGGERATION, getCity, storeyHeight } from './layout'
import { EXAGGERATION } from '../scale'
import { buildShapes, KINDS } from './shapes'

/**
 * THE CITY: buildings and streets that appear as the Year slider moves.
 *
 * Every building and street segment is placed once (layout.ts) with the year it
 * is built. The shader does the rest: it compares that year with the current
 * one, so scrubbing or playing the timeline costs no JavaScript at all, only a
 * single number sent to the GPU.
 *
 *   street    before its year: not there. Then it is laid down from one end
 *             over a few years, as a dirt track, and in time it is paved.
 *   building  before its year: not there. Then it rises out of the ground over a
 *             few years, in the grey of fresh concrete, and ends up in its
 *             own colour. A building that is pulled down sinks away.
 *   flooded   anything whose ground is under the sea is hidden.
 *
 * Buildings sit on the terrain by reading a picture of its height (like the
 * water's depth map), so they also follow sculpting and the Resolution/seed
 * sliders without being placed again.
 */

/** How many years a building takes to rise, and a street to be laid. */
const BUILD_YEARS = 4
const ROAD_YEARS = 6
/** Pixel size of the height picture, world units. */
const HEIGHT_CELL = 2
const HEIGHT_W = Math.ceil((WORLD.x1 - WORLD.x0) / HEIGHT_CELL)
const HEIGHT_H = Math.ceil((WORLD.z1 - WORLD.z0) / HEIGHT_CELL)

/** Terrain height over the whole city, as a half-float picture the shaders can read. */
function buildHeightTexture(params: TerrainParams): DataTexture {
  const data = new Uint16Array(HEIGHT_W * HEIGHT_H)
  for (let j = 0; j < HEIGHT_H; j++) {
    const z = WORLD.z0 + ((j + 0.5) / HEIGHT_H) * (WORLD.z1 - WORLD.z0)
    for (let i = 0; i < HEIGHT_W; i++) {
      const x = WORLD.x0 + ((i + 0.5) / HEIGHT_W) * (WORLD.x1 - WORLD.x0)
      data[j * HEIGHT_W + i] = DataUtils.toHalfFloat(height(x, z, params))
    }
  }
  const tex = new DataTexture(data, HEIGHT_W, HEIGHT_H, RedFormat, HalfFloatType)
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.wrapS = ClampToEdgeWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

// --- shared shader pieces --------------------------------------------------------

interface CityUniforms {
  uYear: IUniform<number>
  uSea: IUniform<number>
  uHK: IUniform<number>
  uFloor: IUniform<number>
  uHeights: IUniform<DataTexture | null>
}

const SHARED_HEADER = /* glsl */ `
uniform float uYear;      // the timeline's year
uniform float uSea;       // sea level
uniform float uHK;        // building height now ÷ at the readable scale
uniform float uFloor;     // storey height now
uniform sampler2D uHeights;
float groundAt(vec2 p) {
  return texture2D(uHeights, vec2((p.x - ${WORLD.x0.toFixed(3)}) / ${(WORLD.x1 - WORLD.x0).toFixed(3)}, (p.y - ${WORLD.z0.toFixed(3)}) / ${(WORLD.z1 - WORLD.z0).toFixed(3)})).r;
}
`

function makeUniforms(): CityUniforms {
  return {
    uYear: { value: 2026 },
    uSea: { value: 0 },
    uHK: { value: 1 },
    uFloor: { value: storeyHeight },
    uHeights: { value: null },
  }
}

// --- buildings ---------------------------------------------------------------------

const BUILDING_VERT_HEADER = /* glsl */ `
${SHARED_HEADER}
attribute vec4 aLife;     // x built year, y pulled-down year, z wall style
varying vec3 vWall;       // where on the wall, in world units
varying float vStyle;
varying float vRise;      // 0 = a hole in the ground … 1 = finished
varying vec3 vObjNormal;
`
const BUILDING_VERT = /* glsl */ `
#include <begin_vertex>
vec3 bInst = instanceMatrix[3].xyz;
float bH = max(length(instanceMatrix[1].xyz), 0.0001);
vec3 bSize = vec3(length(instanceMatrix[0].xyz), bH, length(instanceMatrix[2].xyz));
float bGround = groundAt(bInst.xz);
float bSince = uYear - aLife.x;
float bRise = smoothstep(0.0, ${BUILD_YEARS.toFixed(1)}, bSince);
// a building that is pulled down sinks away over its last two years
float bDown = 1.0 - smoothstep(aLife.y - 2.0, aLife.y, uYear);
float bShow = step(0.0, bSince) * step(uSea, bGround + 0.03) * step(0.001, bDown);
float bGrow = bRise * bDown * uHK;
vRise = bRise;
vStyle = aLife.z;
vObjNormal = normal;
vWall = vec3(position.x * bSize.x, position.y * bSize.y * bGrow, position.z * bSize.z);
transformed.xz *= bShow;
transformed.y = transformed.y * bGrow * bShow + (bGround - 0.12) / bH;
`

const BUILDING_FRAG_HEADER = /* glsl */ `
uniform float uFloor;
varying vec3 vWall;
varying float vStyle;
varying float vRise;
varying vec3 vObjNormal;
`
const BUILDING_FRAG = /* glsl */ `
#include <color_fragment>
{
  float wall = step(abs(vObjNormal.y), 0.5);                 // sides, not roofs
  float along = abs(vObjNormal.x) > abs(vObjNormal.z) ? vWall.z : vWall.x;
  float fy = fract(vWall.y / uFloor);                        // position within a storey
  float fx = fract(along / (uFloor * 1.7));                  // position within a bay
  float punched = step(0.3, fy) * step(fy, 0.8) * step(0.22, fx) * step(fx, 0.78);   // separate windows
  float banded = step(0.18, fy) * step(fy, 0.84) * step(0.05, fx) * step(fx, 0.95);  // glass curtain wall
  float isGlass = step(1.5, vStyle) * step(vStyle, 2.5);
  float isTimber = step(2.5, vStyle);
  float win = mix(punched, banded, isGlass) * (1.0 - 0.7 * isTimber);
  vec3 glassCol = mix(vec3(0.16, 0.24, 0.32), vec3(0.32, 0.44, 0.54), fx);
  diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, win * wall * 0.85);
  diffuseColor.rgb *= mix(0.7, 1.0, wall);                   // roofs a little darker
  // fresh concrete while it is going up
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.54, 0.5), (1.0 - vRise) * 0.7);
}
`

function buildingMaterial(u: CityUniforms): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.85, metalness: 0 })
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BUILDING_VERT_HEADER}`)
      .replace('#include <begin_vertex>', BUILDING_VERT)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${BUILDING_FRAG_HEADER}`)
      .replace('#include <color_fragment>', BUILDING_FRAG)
  }
  return mat
}

// --- streets -------------------------------------------------------------------------

const ROAD_VERT_HEADER = /* glsl */ `
${SHARED_HEADER}
attribute float aBuilt;
varying vec2 vRoad;       // along the street (world units), across it (-0.5 … 0.5)
varying float vFresh;
varying float vWidth;
`
const ROAD_VERT = /* glsl */ `
#include <begin_vertex>
float rSince = uYear - aBuilt;
float rLaid = clamp(rSince / ${ROAD_YEARS.toFixed(1)}, 0.0, 1.0);
float rLen = length(instanceMatrix[0].xyz);
float rWide = length(instanceMatrix[2].xyz);
float rGround = groundAt(instanceMatrix[3].xz);
float rShow = step(0.0, rSince) * step(uSea, rGround + 0.03);
// the street is laid from its start towards its end
float rx = -0.5 + (position.x + 0.5) * rLaid;
vec4 rWorld = instanceMatrix * vec4(rx, 0.0, position.z, 1.0);
vRoad = vec2(position.x * rLen, position.z);
vFresh = 1.0 - rLaid;
vWidth = rWide;
transformed = vec3(rx * rShow, groundAt(rWorld.xz) + 0.1, position.z * rShow);
`

const ROAD_FRAG_HEADER = /* glsl */ `
uniform float uYear;
varying vec2 vRoad;
varying float vFresh;
varying float vWidth;
`
const ROAD_FRAG = /* glsl */ `
#include <color_fragment>
{
  float edge = step(0.36, abs(vRoad.y));                        // the pavement either side
  vec3 asphalt = vec3(0.15, 0.155, 0.17);
  vec3 cobble = vec3(0.34, 0.29, 0.23);                          // dirt and cobbles, before paving
  vec3 road = mix(cobble, asphalt, smoothstep(1840.0, 1910.0, uYear));
  road = mix(road, vec3(0.48, 0.38, 0.28), vFresh * 0.8);        // freshly laid
  float centre = step(abs(vRoad.y), 0.03) * step(0.4, vWidth) * step(0.5, fract(vRoad.x / 0.6)) * smoothstep(1910.0, 1930.0, uYear);
  vec3 col = mix(road, vec3(0.52, 0.52, 0.5), edge * 0.9);
  col = mix(col, vec3(0.85, 0.7, 0.2), centre);
  diffuseColor.rgb = col;
}
`

function roadMaterial(u: CityUniforms): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    roughness: 0.95,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  })
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ROAD_VERT_HEADER}`)
      .replace('#include <begin_vertex>', ROAD_VERT)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROAD_FRAG_HEADER}`)
      .replace('#include <color_fragment>', ROAD_FRAG)
  }
  return mat
}

// --- building the meshes (once) -------------------------------------------------------

function buildCity(u: CityUniforms) {
  const city = getCity()
  const group = new Group()
  const disposables: { dispose(): void }[] = []
  const m4 = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  const pos = new Vector3()
  const scl = new Vector3()
  const tint = new Color()

  // buildings: one InstancedMesh per shape
  const shapes = buildShapes()
  const bMat = buildingMaterial(u)
  disposables.push(bMat)
  for (const kind of KINDS) {
    const lots = city.lots.filter((l) => l.kind === kind)
    if (lots.length === 0) continue
    const geo = shapes[kind]
    const life = new Float32Array(lots.length * 4)
    const mesh = new InstancedMesh(geo, bMat, lots.length)
    lots.forEach((l, i) => {
      q.setFromAxisAngle(up, l.rot)
      m4.compose(pos.set(l.x, 0, l.z), q, scl.set(l.w, l.h, l.d))
      mesh.setMatrixAt(i, m4)
      mesh.setColorAt(i, tint.setRGB(l.r, l.g, l.b, SRGBColorSpace)) // sRGB in, the renderer's linear space stored
      life[i * 4] = l.built
      life[i * 4 + 1] = l.gone
      life[i * 4 + 2] = l.style
    })
    geo.setAttribute('aLife', new InstancedBufferAttribute(life, 4))
    mesh.frustumCulled = false // the shader moves the vertices
    mesh.receiveShadow = true
    group.add(mesh)
    disposables.push(geo)
  }

  // streets: one flat strip per segment, cut along its length so it can follow the ground
  const rGeo = new PlaneGeometry(1, 1, 12, 1).rotateX(-Math.PI / 2)
  const rMat = roadMaterial(u)
  const roads = new InstancedMesh(rGeo, rMat, city.roads.length)
  const built = new Float32Array(city.roads.length)
  city.roads.forEach((r, i) => {
    q.setFromAxisAngle(up, r.rot)
    m4.compose(pos.set(r.x, 0, r.z), q, scl.set(r.len, 1, r.width))
    roads.setMatrixAt(i, m4)
    built[i] = r.built
  })
  rGeo.setAttribute('aBuilt', new InstancedBufferAttribute(built, 1))
  roads.frustumCulled = false
  roads.receiveShadow = true
  group.add(roads)
  disposables.push(rGeo, rMat)

  return { group, disposables }
}

/**
 * The buildings and streets of the city at `year`. `params` is the terrain the
 * city stands on (so it follows sculpting); `scaleMode` shrinks the buildings'
 * heights along with the trees at true scale.
 */
export function City({
  params,
  year,
  scaleMode = 'readable',
  show = true,
}: {
  params: TerrainParams
  year: number
  scaleMode?: ScaleMode
  show?: boolean
}) {
  const uniforms = useMemo(makeUniforms, [])
  const built = useMemo(() => buildCity(uniforms), [uniforms])
  useEffect(
    () => () => built.disposables.forEach((d) => d.dispose()),
    [built],
  )

  // the ground the city stands on; not rebuilt for sea level (that is only a uniform)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heights = useMemo(() => buildHeightTexture(params), shapeKey(params))
  useEffect(() => () => heights.dispose(), [heights])

  // true scale: real height, i.e. the readable (trees ×2.9, buildings ×0.6 of that) taken back out
  const hk = scaleMode === 'true' ? 1 / (EXAGGERATION.readable.objects * BUILDING_EXAGGERATION) : 1
  useFrame(() => {
    uniforms.uHeights.value = heights
    uniforms.uYear.value = year
    uniforms.uSea.value = params.seaLevel
    uniforms.uHK.value = hk
    uniforms.uFloor.value = storeyHeight * hk
  })

  return <primitive object={built.group} visible={show} />
}
