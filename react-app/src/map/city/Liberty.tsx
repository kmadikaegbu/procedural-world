/**
 * THE STATUE OF LIBERTY, on Liberty Island at its real place (40.6892° N,
 * 74.0445° W), built from simple shapes in code: the eleven-pointed star of
 * Fort Wood, Richard Morris Hunt's granite pedestal on its concrete
 * foundation, and Bartholdi's figure with her torch, crown of seven rays and
 * tablet. It follows the History Timeline:
 *
 *   1811        Fort Wood's star-shaped walls are built.
 *   1884–1886   the pedestal rises, then the statue is assembled on it and
 *               dedicated on 28 October 1886.
 *   1886–1906   the copper skin weathers from new-penny brown to green.
 *
 * Sizes are real metres (93 m from the ground to the torch), enlarged by the
 * scale's objects factor like every building's height, so she stands in
 * proportion to the skyline. The island, fort and statue are enlarged together
 * like a map symbol; the real spot is right at the map's west edge, so the
 * enlarged island is nudged east to stay on the map. The figure is a
 * simplified sculpture: the pose and proportions, not the folds of the robe.
 */

import { useEffect, useMemo } from 'react'
import { Color, DoubleSide, LatheGeometry, MeshStandardMaterial, Quaternion, Shape, Vector2, Vector3, type Material } from 'three'
import { height, type TerrainParams } from '../noise'
import { EXAGGERATION, m, type ScaleMode } from '../scale'
import { at } from '../world/project'
import { WORLD } from '../world/shore'

const SITE = at(40.68925, -74.0445)
/** She faces south-east, out through the Narrows to the ocean: her front (+z) turned 45° toward east (+x). */
const FACING = Math.PI / 4

const FORT_YEAR = 1811
const PEDESTAL_FROM = 1884
const PEDESTAL_DONE = 1886
const DEDICATED = 1886.8
/** By about 1906 the copper had turned green. */
const GREEN_BY = 1906

const COPPER = new Color('#b4683a')
const PATINA = new Color('#79b39c')
const GRANITE = '#bcae9d'
const CONCRETE = '#a29c92'
const FORT_STONE = '#8d8576'
const GOLD = '#f2c14e'

/** Where the figure stands: the top of the pedestal, metres above the ground. */
const PEDESTAL_TOP = 46.9
/** Fort Wood's star, metres: the points' radius and the notches' radius, and the walls' height. */
const FORT = { outer: 44, inner: 31, height: 7 }
/** The island around it, metres: a simplified oval (the real one is ~450 m long), and its height above the water. */
const ISLAND = { radius: 55, height: 3 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z)

/** A square frustum (a four-sided cylinder turned 45°), by its side lengths, metres. */
function Block({ y0, y1, bottom, top = bottom, color }: { y0: number; y1: number; bottom: number; top?: number; color: string }) {
  return (
    <mesh position-y={(y0 + y1) / 2} rotation-y={Math.PI / 4} castShadow receiveShadow>
      <cylinderGeometry args={[(top / 2) * Math.SQRT2, (bottom / 2) * Math.SQRT2, y1 - y0, 4, 1]} />
      <meshStandardMaterial color={color} roughness={0.9} flatShading />
    </mesh>
  )
}

/** A rod from a to b, tapering from radius r0 to r1 (metres). */
function Rod({ a, b, r0, r1, material }: { a: Vector3; b: Vector3; r0: number; r1: number; material: Material }) {
  const d = b.clone().sub(a)
  const quat = new Quaternion().setFromUnitVectors(v3(0, 1, 0), d.clone().normalize())
  return (
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={quat} material={material} castShadow>
      <cylinderGeometry args={[r1, r0, d.length(), 14]} />
    </mesh>
  )
}

/** The robed body: a lathe from the hem to the neck, oval in plan. */
function robeGeometry() {
  const profile: [number, number][] = [
    [0, 0],
    [4.6, 0],
    [4.7, 1.2],
    [4.2, 5],
    [3.6, 11],
    [3.2, 17],
    [3.1, 21],
    [3.4, 24.5], // the bust
    [3.3, 26.2],
    [2.4, 27.6], // the shoulders round in
    [1.2, 28.4],
    [0, 28.6],
  ]
  const g = new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 28)
  g.scale(1, 1, 0.78) // deeper side to side than front to back
  return g
}

/** The eleven-pointed star of Fort Wood, as a flat shape in x / −z (laid flat by rotating −90° about x). */
function starShape() {
  const s = new Shape()
  const n = 11
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? FORT.outer : FORT.inner
    const x = Math.sin(a) * r
    const y = Math.cos(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  return s
}

export function Liberty({ params, year, scaleMode }: { params: TerrainParams; year: number; scaleMode: ScaleMode }) {
  const objects = EXAGGERATION[scaleMode].objects
  const unit = m(1) // world units per metre
  // The whole monument (island, fort, pedestal and statue) is enlarged together, like a
  // map symbol. The real spot is only ~42 m inside the map's west edge, so the enlarged
  // island is nudged east just enough to stay on the map (about 150 m at the readable scale).
  const islandRadius = m(ISLAND.radius) * objects
  const x = Math.max(SITE[0], WORLD.x0 + islandRadius * 1.15 + 0.2)
  const z = SITE[1]
  const ground = Math.max(height(x, z, params), params.seaLevel)

  const parts = useMemo(() => ({ robe: robeGeometry(), star: starShape() }), [])

  // the copper weathers to green between the dedication and about 1906 (in steps of 1%, so it isn't rebuilt every frame of Play)
  const patina = Math.round(smooth(DEDICATED, GREEN_BY, year) * 100) / 100

  if (year < FORT_YEAR) return null
  // the pedestal rises over 1884–86; then the statue goes up on it
  const pedestal = smooth(PEDESTAL_FROM, PEDESTAL_DONE, year)
  const statue = smooth(PEDESTAL_DONE, DEDICATED, year)

  return (
    <group position={[x, ground, z]} scale={unit * objects}>
      {/* Liberty Island: a low green island with a stone seawall, its long side running north-west */}
      <group rotation-y={-FACING}>
        <mesh position-y={ISLAND.height / 2 - 2} scale={[1.15, 1, 0.85]} castShadow receiveShadow>
          <cylinderGeometry args={[ISLAND.radius, ISLAND.radius + 2, ISLAND.height + 4, 40]} />
          <meshStandardMaterial color="#8a8274" roughness={0.95} />
        </mesh>
        <mesh position-y={ISLAND.height + 0.05} rotation-x={-Math.PI / 2} scale={[1.15 * 0.97, 0.85 * 0.97, 1]} receiveShadow>
          <circleGeometry args={[ISLAND.radius, 40]} />
          <meshStandardMaterial color="#6f8f52" roughness={1} />
        </mesh>
      </group>

      <group position-y={ISLAND.height}>
        {/* Fort Wood */}
        <mesh rotation-x={-Math.PI / 2} castShadow receiveShadow>
          <extrudeGeometry args={[parts.star, { depth: FORT.height, bevelEnabled: false }]} />
          <meshStandardMaterial color={FORT_STONE} roughness={0.95} flatShading side={DoubleSide} />
        </mesh>

        {pedestal > 0 && (
          <group rotation-y={FACING} scale={[1, pedestal, 1]}>
            <Pedestal />
            {statue > 0 && (
              <group position-y={PEDESTAL_TOP} scale={[1, statue / Math.max(pedestal, 1e-3), 1]}>
                <Figure robe={parts.robe} patina={patina} />
              </group>
            )}
          </group>
        )}
      </group>
    </group>
  )
}

/** The concrete foundation and Hunt's granite pedestal: 46.9 m together. */
function Pedestal() {
  return (
    <group>
      {/* the foundation, a stepped concrete pyramid inside the fort */}
      <Block y0={0} y1={19.8} bottom={27.7} top={20.3} color={CONCRETE} />
      {/* the pedestal: a plinth, a tapering shaft, the loggia band, the cornice and the parapet */}
      <Block y0={19.8} y1={24} bottom={19.4} top={18.6} color={GRANITE} />
      <Block y0={24} y1={36.5} bottom={16.6} top={15.4} color={GRANITE} />
      <Block y0={36.5} y1={40.5} bottom={15.6} top={15.6} color="#9c8f80" />
      <Block y0={40.5} y1={42.2} bottom={17.4} top={17.4} color={GRANITE} />
      <Block y0={42.2} y1={PEDESTAL_TOP} bottom={13.4} top={12.6} color={GRANITE} />
    </group>
  )
}

/**
 * Liberty herself, from her feet (y = 0) to the tip of the flame (about 46 m).
 * Her front is +z; her right hand (−x) raises the torch, her left (+x) holds
 * the tablet dated JULY IV MDCCLXXVI.
 */
function Figure({ robe, patina }: { robe: LatheGeometry; patina: number }) {
  // new copper is shiny and brown; the patina is matte and green
  const skinMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: COPPER.clone().lerp(PATINA, patina),
        metalness: 0.4 * (1 - patina) + 0.05,
        roughness: 0.45 + 0.35 * patina,
        flatShading: true,
      }),
    [patina],
  )
  useEffect(() => () => skinMaterial.dispose(), [skinMaterial])
  const gold = useMemo(
    () => new MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.3, emissive: GOLD, emissiveIntensity: 0.25 }),
    [],
  )
  useEffect(() => () => gold.dispose(), [gold])

  // the crown's seven rays fan out across the front of the head
  const rays = [-90, -60, -30, 0, 30, 60, 90].map((deg) => {
    const a = (deg * Math.PI) / 180
    const dir = v3(Math.sin(a), 0.5, Math.cos(a)).normalize()
    const base = v3(Math.sin(a) * 2.2, 32.6, Math.cos(a) * 2.0)
    return { base, tip: base.clone().addScaledVector(dir, 3.4) }
  })

  const rightShoulder = v3(-2.7, 26.8, 0)
  const torchHand = v3(-3.9, 40.6, 0.5)

  return (
    <group>
      <mesh geometry={robe} material={skinMaterial} castShadow receiveShadow />
      {/* the stola, draped from the left shoulder across the body */}
      <Rod a={v3(2.6, 26.5, 1.4)} b={v3(-2.2, 15, 2.6)} r0={0.9} r1={0.7} material={skinMaterial} />

      {/* neck and head, turned a little to her right as she gazes out */}
      <Rod a={v3(0, 28, 0)} b={v3(0, 30.2, 0.1)} r0={1.15} r1={1.05} material={skinMaterial} />
      <mesh position={[0, 31.5, 0.25]} scale={[2.05, 2.5, 2.2]} material={skinMaterial} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
      </mesh>
      {/* the crown: a diadem and seven rays */}
      <mesh position-y={32.7} material={skinMaterial} castShadow>
        <cylinderGeometry args={[2.35, 2.3, 0.9, 20]} />
      </mesh>
      {rays.map((r, i) => (
        <Rod key={i} a={r.base} b={r.tip} r0={0.32} r1={0.05} material={skinMaterial} />
      ))}

      {/* the right arm, raised, and the torch */}
      <Rod a={rightShoulder} b={v3(-3.4, 33.5, 0.2)} r0={1.35} r1={1.0} material={skinMaterial} />
      <Rod a={v3(-3.4, 33.5, 0.2)} b={torchHand} r0={1.0} r1={0.75} material={skinMaterial} />
      <Rod a={torchHand} b={v3(-4.0, 42.4, 0.55)} r0={0.5} r1={0.55} material={skinMaterial} />
      <mesh position={[-4.0, 42.9, 0.55]} material={skinMaterial} castShadow>
        <cylinderGeometry args={[1.25, 0.7, 1.1, 16]} />
      </mesh>
      <mesh position={[-4.0, 43.35, 0.55]} rotation-x={Math.PI / 2} material={skinMaterial}>
        <torusGeometry args={[1.45, 0.12, 6, 20]} />
      </mesh>
      <mesh position={[-4.0, 44.7, 0.55]} scale={[0.85, 1.6, 0.85]} material={gold}>
        <sphereGeometry args={[1, 14, 12]} />
      </mesh>

      {/* the left arm and the tablet, held against her side */}
      <Rod a={v3(2.7, 26.6, 0)} b={v3(3.4, 21.2, 0.8)} r0={1.2} r1={0.9} material={skinMaterial} />
      <mesh position={[3.4, 22.6, 1.3]} rotation={[0.12, -0.25, 0.32]} material={skinMaterial} castShadow>
        <boxGeometry args={[4.1, 7.2, 0.6]} />
      </mesh>
    </group>
  )
}
