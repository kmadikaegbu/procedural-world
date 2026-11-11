/**
 * CAMERA FLIGHTS: glide the orbit camera to a new place instead of jumping
 * there. The camera keeps the direction it faces, looks down at least a little
 * (so towers in front don't hide the place), and rises in the middle of a long
 * flight so you can see where it's going. Any drag or zoom of your own stops
 * the flight where it is.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

export interface Flight {
  /** The point to look at, world units. */
  x: number
  y: number
  z: number
  /** How far back to stand from it. */
  distance: number
}

interface Leg {
  fromTarget: Vector3
  toTarget: Vector3
  fromCamera: Vector3
  toCamera: Vector3
  /** How high the camera rises at the middle of the flight. */
  hop: number
  seconds: number
  t: number
}

/** Look down at least this steeply (the y of the unit view direction). */
const MIN_LOOK_DOWN = 0.5

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function CameraFlight({
  controls,
  flight,
}: {
  controls: RefObject<OrbitControlsImpl | null>
  /** Set a new object to start a flight; null does nothing. */
  flight: Flight | null
}) {
  const leg = useRef<Leg | null>(null)
  // a flight asked for before the controls exist (on the first frame) waits here
  const pending = useRef<Flight | null>(null)
  const listening = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    pending.current = flight
  }, [flight])

  const start = (c: OrbitControlsImpl, f: Flight) => {
    const dir = c.object.position.clone().sub(c.target).normalize()
    dir.y = Math.max(dir.y, MIN_LOOK_DOWN)
    dir.normalize()
    const toTarget = new Vector3(f.x, f.y, f.z)
    const toCamera = toTarget.clone().addScaledVector(dir, f.distance)
    const across = c.target.distanceTo(toTarget)
    leg.current = {
      fromTarget: c.target.clone(),
      toTarget,
      fromCamera: c.object.position.clone(),
      toCamera,
      hop: Math.min(across * 0.35, 220),
      seconds: Math.min(3.2, 1.4 + across / 300),
      t: 0,
    }
  }

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    if (listening.current !== c) {
      // your own drag or zoom takes over from a flight
      c.addEventListener('start', () => (leg.current = null))
      listening.current = c
    }
    if (pending.current) {
      start(c, pending.current)
      pending.current = null
    }
    const l = leg.current
    if (!l) return
    l.t = Math.min(1, l.t + delta / l.seconds)
    const e = ease(l.t)
    c.target.lerpVectors(l.fromTarget, l.toTarget, e)
    c.object.position.lerpVectors(l.fromCamera, l.toCamera, e)
    c.object.position.y += Math.sin(Math.PI * e) * l.hop
    c.update()
    if (l.t >= 1) leg.current = null
  })

  return null
}
