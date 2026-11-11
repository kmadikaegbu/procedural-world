/**
 * ISLAND LIFE SETTINGS — the People tab. See sim.ts for the simulation itself.
 */

import type { Role } from './sim'

export interface IslandLifeSettings {
  show: boolean
  /** Simulated minutes per real second. */
  speed: number
  /**
   * Up close people are drawn at their real height × the scale's objects factor,
   * the same ruler as the trees and buildings. From the usual camera distance
   * that is a speck, so they also grow with distance, up to this many times.
   */
  size: number
  /** Draw the trash tubes, the trash moving in them, and the station queues' labels. */
  flows: boolean
  /** Tint each person with their role's colour, instead of their own clothes. */
  roleColors: boolean
}

export const ISLAND_LIFE_DEFAULTS: IslandLifeSettings = {
  show: true,
  speed: 3,
  size: 8,
  flows: true,
  roleColors: false,
}

export const ROLE_INFO: Record<Role, { label: string; color: string; title: string }> = {
  commuter: { label: 'Commuters', color: '#5aa9ff', title: 'Residents who work off the island. They leave in the morning rush by Tram, subway or bus, and come back in the evening, some stopping at the shops.' },
  worker: { label: 'Local workers', color: '#3fd0c0', title: 'Residents who work on the island: at the hospitals, the school, the shops or the campus.' },
  child: { label: 'Children', color: '#ffd23f', title: 'Children going to the island school (from 1993; before that, off the island), then to Capobianco Field or home.' },
  retiree: { label: 'Retirees', color: '#c9a0ff', title: 'Residents at home in the day: a walk in a park in the morning, the shops in the afternoon.' },
  student: { label: 'Cornell Tech students', color: '#ff5a5f', title: 'Students who live in The House and go to class on the campus next door (from 2017).' },
  staff: { label: 'Hospital staff', color: '#e8f4f0', title: 'Staff who come in for one of three shifts, at 7:00, 15:00 and 23:00, so the hospitals keep the island busy at night.' },
  campus: { label: 'Campus staff', color: '#f0943e', title: 'Faculty, staff and students who come to Cornell Tech for the day.' },
  teacher: { label: 'Teachers', color: '#9be27a', title: 'Teachers who come to the island school for the day.' },
  visitor: { label: 'Visitors', color: '#ff8fd0', title: 'Day trippers who ride the Tram out to Four Freedoms Park (from 2012).' },
}

/** The trash moving in the AVAC tubes. */
export const TRASH_COLOR = '#ffb000'
