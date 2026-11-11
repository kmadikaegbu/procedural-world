import { activeIslandSim } from './sim'

/** A time of day as hh:mm. */
export const clockText = (minute: number) => {
  const h = Math.floor(minute / 60)
  const mm = Math.floor(minute % 60)
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Times of day worth jumping to. */
export const MOMENTS: { label: string; minute: number; title: string }[] = [
  { label: 'Morning rush', minute: 7 * 60 + 30, title: 'Commuters queue for the Tram and the subway; children walk to school; the night shift goes home.' },
  { label: 'Midday', minute: 12 * 60, title: 'Retirees in the parks, students at lunch, visitors heading for Four Freedoms Park.' },
  { label: 'Evening', minute: 17 * 60 + 45, title: 'Everyone comes home, some by way of the shops on Main Street.' },
  { label: 'Night', minute: 23 * 60, title: 'The island is home, but the hospitals change shifts.' },
]

/** Jump the simulation's clock. */
export const jumpTo = (minute: number) => activeIslandSim()?.setTime(minute)

