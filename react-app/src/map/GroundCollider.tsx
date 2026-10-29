import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { height, shapeKey, type TerrainParams } from './noise'
import { axisLines } from './world/grid'
import { DETAIL_HALF, WORLD } from './world/shore'

// grid spacing of the hidden ground: fine enough around Roosevelt Island that
// a brush lands where you point (its banks are only ~3.5 units wide), coarse
// across the rest of the city
const FINE_STEP = 1.25
const COARSE_STEP = 4

/**
 * THE BRUSHES' GROUND. The sculpt and paint brushes find the ground by
 * ray-casting, which tests every triangle — far too many in the whole-city
 * terrain mesh or the voxel cubes. So those are skipped, and this hidden,
 * lighter copy of the height field takes the rays instead. It follows
 * sculpting, so the brush lands on the terrain you see.
 */
export function GroundCollider({ params }: { params: TerrainParams }) {
  const geometry = useMemo(() => {
    const xs = axisLines(WORLD.x0, WORLD.x1, FINE_STEP, COARSE_STEP, DETAIL_HALF)
    const zs = axisLines(WORLD.z0, WORLD.z1, FINE_STEP, COARSE_STEP, DETAIL_HALF)
    const nx = xs.length
    const nz = zs.length
    const pos = new Float32Array(nx * nz * 3)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 3
        pos[k] = xs[i]
        pos[k + 1] = height(xs[i], zs[j], params)
        pos[k + 2] = zs[j]
      }
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6)
    let n = 0
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i
        idx[n++] = a; idx[n++] = a + nx; idx[n++] = a + 1
        idx[n++] = a + 1; idx[n++] = a + nx; idx[n++] = a + nx + 1
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    geo.computeBoundingSphere()
    return geo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, shapeKey(params))
  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} visible={false} userData={{ ground: true }} />
}
