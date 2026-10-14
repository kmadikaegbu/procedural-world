import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { height, type TerrainParams } from './noise'
import { groundHit } from './TerraformBrush'
import { MASK_CELL, MASK_RES, paintMask, type ScatterMask } from './scatter'

// same cadence as the sculpt brush: a stroke is pushed into React state ~12×/s,
// which re-scatters the forest, so every frame would stall the drag
const COMMIT_INTERVAL_MS = 80

const PAINT_COLOR = '#22d3ee'
const ERASE_COLOR = '#f16565'

/**
 * Wraps a map scene. While `enabled`, left-drag paints (or erases) the planting
 * mask on the land under the cursor; the painted cells are drawn as a
 * translucent overlay. Strokes accumulate in a working copy and are handed up
 * through `onChange` as a new ScatterMask.
 */
export function ScatterMaskBrush({
  enabled,
  erase,
  radius,
  mask,
  params,
  showOverlay,
  onChange,
  children,
}: {
  enabled: boolean
  erase: boolean
  radius: number
  mask: ScatterMask
  params: TerrainParams
  /** Draw the painted cells (while painting, or while the mask is limiting the scatter). */
  showOverlay: boolean
  onChange: (mask: ScatterMask) => void
  children: ReactNode
}) {
  // handlers read the latest values through refs, so they don't need
  // re-binding every time a stroke commits a new mask
  const maskRef = useRef(mask)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    maskRef.current = mask
    onChangeRef.current = onChange
  }, [mask, onChange])

  const hover = useRef<THREE.Vector3 | null>(null)
  const working = useRef<Uint8Array | null>(null)
  const lastCommit = useRef(0)
  const cursor = useRef<THREE.Mesh>(null)

  const commit = () => {
    if (!working.current) return
    lastCommit.current = performance.now()
    onChangeRef.current({ res: MASK_RES, data: working.current.slice() })
  }

  // end the stroke wherever the button is released — even off the canvas
  useEffect(() => {
    const end = () => {
      if (!working.current) return
      commit()
      working.current = null
    }
    window.addEventListener('pointerup', end)
    return () => window.removeEventListener('pointerup', end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (enabled) return
    hover.current = null
    working.current = null
  }, [enabled])

  const dab = (p: THREE.Vector3) => {
    if (!working.current) return
    paintMask(working.current, MASK_RES, p.x, p.z, radius, erase ? 0 : 1)
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled) return
    const hit = groundHit(e)
    if (!hit) return
    e.stopPropagation()
    hover.current = (hover.current ?? new THREE.Vector3()).copy(hit.point)
    if (working.current) {
      dab(hover.current)
      if (performance.now() - lastCommit.current > COMMIT_INTERVAL_MS) commit()
    }
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled || e.button !== 0) return
    const hit = groundHit(e)
    if (!hit) return
    e.stopPropagation()
    hover.current = (hover.current ?? new THREE.Vector3()).copy(hit.point)
    working.current = maskRef.current.data.slice()
    dab(hover.current)
    commit()
  }

  useFrame(() => {
    const h = hover.current
    if (cursor.current) {
      cursor.current.visible = enabled && h !== null
      if (h) cursor.current.position.set(h.x, h.y + 0.15, h.z)
      cursor.current.scale.setScalar(radius)
    }
  })

  return (
    <group
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={() => (hover.current = null)}
    >
      {children}
      {showOverlay && <MaskOverlay mask={mask} params={params} />}

      <mesh
        ref={cursor}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        renderOrder={10}
        raycast={() => null}
      >
        <ringGeometry args={[0.94, 1, 64]} />
        <meshBasicMaterial
          color={erase ? ERASE_COLOR : PAINT_COLOR}
          depthTest={false}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** The painted cells, as ONE instanced mesh of flat squares resting on the terrain. */
function MaskOverlay({
  mask,
  params,
}: {
  mask: ScatterMask
  params: TerrainParams
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    [],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new THREE.Object3D()
    const half = MASK_RES / 2
    let n = 0
    for (let j = 0; j < MASK_RES; j++) {
      for (let i = 0; i < MASK_RES; i++) {
        if (!mask.data[j * MASK_RES + i]) continue
        const x = (i + 0.5 - half) * MASK_CELL
        const z = (j + 0.5 - half) * MASK_CELL
        o.position.set(x, height(x, z, params) + 0.3, z)
        o.scale.setScalar(MASK_CELL * 0.92)
        o.updateMatrix()
        mesh.setMatrixAt(n++, o.matrix)
      }
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  }, [mask, params])

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, MASK_RES * MASK_RES]}
      frustumCulled={false}
      renderOrder={5}
      raycast={() => null} // never a brush target itself
    >
      <meshBasicMaterial
        color={PAINT_COLOR}
        transparent
        opacity={0.38}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
