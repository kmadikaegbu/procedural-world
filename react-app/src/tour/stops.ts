/**
 * The tour's five stops, and what each one watches for (see Tour.tsx).
 */

import { TIMELINE_DEFAULT, TIMELINE_MAX } from '../map/timeline'

/** The places the camera can fly to (the buttons under the History Timeline). */
export type Place = 'island' | 'battery' | 'midtown'

/** What the tour can see of the app, to tell when a stop is done. */
export interface TourState {
  year: number
  /** Where the camera last flew to with a fly-to button (null if it never has). */
  place: Place | null
  playing: boolean
}

/** What the tour can do in the app, for each stop's "show me" button. */
export interface TourActions {
  setYear: (year: number) => void
  play: () => void
  stop: () => void
  fly: (place: Place) => void
}

interface Stop {
  /** One or two words, for the checklist. */
  short: string
  title: string
  text: string
  done: (s: TourState) => boolean
  button: string
  show: (a: TourActions) => void
}

export const STOPS: Stop[] = [
  {
    short: '1609',
    title: 'Mannahatta, 1609',
    text: 'Before the city: forest, meadow and marsh, and the animals that live in them. Drag the Year slider all the way back to 1609.',
    done: (s) => s.year <= 1620,
    button: 'Take me to 1609',
    show: (a) => {
      a.stop()
      a.setYear(1609)
      a.fly('battery')
    },
  },
  {
    short: 'Spread',
    title: 'The city spreads',
    text: 'Press ▶ Play. The city grows north from the Battery and clears the forest as it goes. Watch for 1811, when the street grid is laid across Manhattan.',
    done: (s) => s.year >= 1811,
    button: 'Play',
    show: (a) => a.play(),
  },
  {
    short: 'Skyline',
    title: 'The real skyline',
    text: "Every building standing today rises in the year the city's records say it was built. Fly to Midtown and keep playing past 1930, when most of its towers went up.",
    done: (s) => s.year >= 1930 && s.place === 'midtown',
    button: 'Fly to Midtown',
    show: (a) => {
      a.fly('midtown')
      a.play()
    },
  },
  {
    short: 'Animals',
    title: 'The last wild land',
    text: "By today the city has paved nearly everything, and the deer and foxes are down to Roosevelt Island, which was never paved. Come back to today and fly to the Island to find them.",
    done: (s) => s.place === 'island' && !s.playing && Math.abs(s.year - TIMELINE_DEFAULT) <= 5,
    button: 'Show me',
    show: (a) => {
      a.stop()
      a.setYear(TIMELINE_DEFAULT)
      a.fly('island')
    },
  },
  {
    short: '2100',
    title: 'The water rises',
    text: "Drag on to 2100. Up to today the sea follows the Battery tide gauge, drawn 15× higher so you can see it. After today it's a made-up curve, not a forecast.",
    done: (s) => s.year >= TIMELINE_MAX - 5,
    button: 'Go to 2100',
    show: (a) => {
      a.stop()
      a.setYear(TIMELINE_MAX)
    },
  },
]
