/**
 * The wildlife simulation that's running now, so code outside the Wildlife
 * component (the follow camera, FollowCam.tsx) can find an animal to watch.
 */

import type { WildlifeSim } from './sim'

let active: WildlifeSim | null = null

export const setActiveSim = (sim: WildlifeSim | null) => {
  active = sim
}

export const activeSim = () => active
