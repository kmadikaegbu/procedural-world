import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { baseHeight, height, type TerrainParams } from './noise'
import {
  applyBrush,
  EDIT_RES,
  type BrushTool,
  type TerrainEdits,
} from './terraform'

// how often a stroke in progress is pushed into React state (and so how often
// the terrain, voxels, trees, and minimap regenerate) — every frame would
// stall the drag; ~12×/s keeps it feeling live
const COMMIT_INTERVAL_MS = 80

// ring color per tool, from the app's palette (index.css)
const TOOL_COLORS: Record<BrushTool, string> = {
  raise: '#e8e6ef', // --text
  lower: '#f16565', // --accent-red
  flatten: '#b794f6', // --accent-purple
}

/** True if this object, or anything it's nested in, is marked as ground. */
function isGround(obj: THREE.Object3D | null): boolean {
  for (let o = obj; o; o = o.parent) if (o.userData.ground) return true
  return false
}

/**
 * The nearest surface a brush can land on: terrain, voxels (each a drei
 * <Instance> nested under a marked group), or water — never trees.
 */
export function groundHit(e: ThreeEvent<PointerEvent>) {
  return e.intersections.find((i) => isGround(i.object))
}

/**
 * Wraps a map scene and turns left-drag into terrain sculpting while
 * `enabled`. Raise/lower push the land up or down under the cursor;
 * flatten levels everything under the brush to the height where the stroke
 * started. Edits accumulate in a working grid during the stroke and are
 * handed up through `onChange` as a new TerrainEdits object.
 */
export function TerraformBrush({
  enabled,
  tool,
  radius,
  strength,
  params,
  onStrokeStart,
  onChange,
  children,
}: {
  enabled: boolean
  tool: BrushTool
  radius: number
  strength: number // world units/second at the brush centre
  params: TerrainParams
  /** Fired once per stroke, before any change — lets the parent snapshot for undo. */
  onStrokeStart: () => void
  onChange: (edits: TerrainEdits) => void
  children: ReactNode
}) {
  // handlers and the frame loop read the latest params through a ref, so
  // they don't need re-binding every time a stroke commits new edits
  const paramsRef = useRef(params)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    paramsRef.current = params
    onChangeRef.current = onChange
  }, [params, onChange])

  const hover = useRef<THREE.Vector3 | null>(null)
  const working = useRef<Float32Array | null>(null)
  const flattenTarget = useRef(0)
  const lastCommit = useRef(0)
  const cursor = useRef<THREE.Mesh>(null)

  // reads only refs, so it's safe to call from the window listener below
  const commit = () => {
    if (!working.current) return
    lastCommit.current = performance.now()
    onChangeRef.current({ res: EDIT_RES, data: working.current.slice() })
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

  // switching the brush off mid-stroke finishes that stroke cleanly
  useEffect(() => {
    if (enabled) return
    hover.current = null
    working.current = null
  }, [enabled])

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled) return
    const hit = groundHit(e)
    if (!hit) return
    e.stopPropagation()
    hover.current = (hover.current ?? new THREE.Vector3()).copy(hit.point)
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!enabled || e.button !== 0) return
    const hit = groundHit(e)
    if (!hit) return
    e.stopPropagation()
    hover.current = (hover.current ?? new THREE.Vector3()).copy(hit.point)

    const p = paramsRef.current
    onStrokeStart()
    working.current = p.edits
      ? p.edits.data.slice()
      : new Float32Array(EDIT_RES * EDIT_RES)
    flattenTarget.current = height(hit.point.x, hit.point.z, p)
    lastCommit.current = performance.now()
  }

  useFrame((_, delta) => {
    const h = hover.current
    if (cursor.current) {
      cursor.current.visible = enabled && h !== null
      if (h) cursor.current.position.set(h.x, h.y + 0.15, h.z)
      cursor.current.scale.setScalar(radius)
    }

    if (!working.current || !h) return
    const p = paramsRef.current
    applyBrush(
      working.current,
      EDIT_RES,
      tool,
      h.x,
      h.z,
      radius,
      strength,
      Math.min(delta, 0.05), // a dropped frame shouldn't land as one giant dab
      flattenTarget.current,
      (x, z) => baseHeight(x, z, p),
    )
    if (performance.now() - lastCommit.current > COMMIT_INTERVAL_MS) commit()
  })

  return (
    <group
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerLeave={() => (hover.current = null)}
    >
      {children}

      {/* brush outline: a unit ring scaled to the brush radius, drawn on top
          of everything so it stays visible on steep slopes */}
      <mesh
        ref={cursor}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        renderOrder={10}
        raycast={() => null} // never a brush target itself
      >
        <ringGeometry args={[0.94, 1, 64]} />
        <meshBasicMaterial
          color={TOOL_COLORS[tool]}
          depthTest={false}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
