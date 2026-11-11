/**
 * THE FOLLOW CAMERA: picks one animal of a species and keeps the camera on it,
 * close enough to see a deer graze or a bird beat its wings. You can still
 * orbit and zoom around it; the camera just carries along as it moves. When
 * the animal leaves or dies, it moves on to the nearest one of the same kind.
 */

import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { activeSim } from './active'
import type { Agent, AgentState, Species } from './sim'

/** How far back the camera starts from each kind of animal, in world units (×33.5 m). */
const START_DISTANCE: Record<Species, number> = { bird: 3, deer: 1.4, fox: 1.1 }

const NAMES: Record<Species, string> = { bird: 'a bird', deer: 'a deer', fox: 'a fox' }
const PLURAL: Record<Species, string> = { bird: 'birds', deer: 'deer', fox: 'foxes' }

/** What each state looks like, in a few words. */
const DOING: Record<AgentState, string> = {
  flock: 'flying with the flock',
  graze: 'grazing',
  flee: 'running from a fox',
  wander: 'wandering',
  hunt: 'hunting',
  eat: 'eating',
  rest: 'resting',
  displaced: 'looking for wild land',
  leaving: 'leaving: its land is gone',
  drink: 'drinking',
  alert: 'on alert',
  stalk: 'stalking',
  perch: 'perched',
}

export function FollowCam({
  controls,
  species,
  onStatus,
}: {
  controls: RefObject<OrbitControlsImpl | null>
  /** The kind of animal to follow, or null to leave the camera alone. */
  species: Species | null
  /** What the animal is doing, in words (null when there's nothing to say). */
  onStatus: (text: string | null) => void
}) {
  const followed = useRef<Agent | null>(null)
  const fresh = useRef(true)
  const said = useRef('')
  const clock = useRef(0)
  const want = useRef(new Vector3())

  // a new species: start over, and fly in when the first animal is found
  useEffect(() => {
    followed.current = null
    fresh.current = true
    said.current = ''
    if (!species) onStatus(null)
  }, [species, onStatus])

  useFrame((_, delta) => {
    const c = controls.current
    if (!species || !c) return
    const sim = activeSim()
    const say = (text: string) => {
      if (text !== said.current) {
        said.current = text
        onStatus(text)
      }
    }

    let a = followed.current
    if (!a || !sim?.agents.includes(a) || a.state === 'leaving') {
      // the nearest one of the kind to where the camera is looking
      a = null
      let best = Infinity
      for (const b of sim?.agents ?? []) {
        if (b.species !== species || b.state === 'leaving') continue
        const d = Math.hypot(b.x - c.target.x, b.z - c.target.z)
        if (d < best) {
          best = d
          a = b
        }
      }
      followed.current = a
    }
    if (!a) {
      say(`No ${PLURAL[species]} left on the wild land. Go back in time to find some.`)
      return
    }

    want.current.set(a.x, a.y + (species === 'bird' ? 0 : 0.05), a.z)
    if (fresh.current) {
      // fly in: keep the way the camera faces, but look down at it from close by
      fresh.current = false
      const dir = c.object.position.clone().sub(c.target).normalize()
      dir.y = Math.max(dir.y, 0.35)
      dir.normalize()
      c.target.copy(want.current)
      c.object.position.copy(want.current).addScaledVector(dir, START_DISTANCE[species])
    } else {
      // carry the camera along with the animal, smoothly; orbit and zoom stay yours
      const step = want.current.sub(c.target).multiplyScalar(1 - Math.exp(-delta * (species === 'bird' ? 12 : 5))) // birds are fast: keep up
      c.target.add(step)
      c.object.position.add(step)
    }
    c.update()

    if ((clock.current -= delta) <= 0) {
      clock.current = 0.4
      say(`Following ${NAMES[species]}: ${DOING[a.state] ?? a.state}`)
    }
  })

  return null
}
