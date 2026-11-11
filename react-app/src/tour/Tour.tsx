/**
 * THE TOUR: a short guided first run through the city's history, five stops
 * from Mannahatta to 2100. Each stop says what to do and ticks itself off when
 * you've done it (or press its button and the app does it for you), so the
 * checklist along the top fills in as you explore.
 *
 * Borrowed as an idea (not code) from a classmate's project, Jessica Hsiao's
 * Wildform, which teaches its game the same way: one hint at a time, with a
 * checklist of the goal's steps.
 */

import { STOPS, type TourActions } from './stops'

interface Props {
  /** The stop on screen; STOPS.length means the tour is finished. */
  step: number
  /** How many stops have been done, in order. */
  doneCount: number
  actions: TourActions
  onStep: (step: number) => void
  onClose: () => void
  onOpenLab: () => void
}

/** The tour card, at the top of the screen. */
export function Tour({ step, doneCount, actions, onStep, onClose, onOpenLab }: Props) {
  const finished = step >= STOPS.length
  const stop = STOPS[Math.min(step, STOPS.length - 1)]
  const isDone = step < doneCount

  return (
    <section className="tour" aria-label="Guided tour">
      <ol className="tour-steps">
        {STOPS.map((s, i) => (
          <li key={s.short}>
            <button
              className={(i < doneCount ? 'done' : '') + (i === step ? ' current' : '')}
              onClick={() => onStep(i)}
              title={s.title}
            >
              <span aria-hidden>{i < doneCount ? '✓' : i + 1}</span> {s.short}
            </button>
          </li>
        ))}
      </ol>

      {finished ? (
        <>
          <h2>That's the whole history</h2>
          <p>
            Explore on your own: drag the Year, fly around, change the weather. The Lab
            has every slider: the terrain's noise, the sculpt brush, the trees and the
            animals' behaviour.
          </p>
          <div className="tour-actions">
            <button className="primary" onClick={onClose}>
              Explore
            </button>
            <button onClick={onOpenLab}>Open the Lab</button>
          </div>
        </>
      ) : (
        <>
          <h2>
            {stop.title}
            {isDone && <span className="tour-check"> ✓</span>}
          </h2>
          <p>{stop.text}</p>
          <div className="tour-actions">
            {isDone ? (
              <button className="primary" onClick={() => onStep(step + 1)}>
                Next
              </button>
            ) : (
              <button className="primary" onClick={() => stop.show(actions)}>
                {stop.button}
              </button>
            )}
            <button onClick={onClose}>Skip the tour</button>
          </div>
        </>
      )}
    </section>
  )
}
