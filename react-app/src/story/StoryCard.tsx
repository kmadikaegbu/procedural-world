/**
 * The story card, at the bottom of the screen: the chapter of New York's story
 * the timeline has reached, with the population of the day. The arrows step
 * from chapter to chapter; "Show me" flies the camera back to where it happened.
 */

import { formatPopulation, populationForYear } from '../map/city/population'
import { CHAPTERS, chapterAt, type Chapter } from './chapters'

interface Props {
  year: number
  /** Play holds on each chapter for a moment (see App's Play loop). */
  holding: boolean
  onJump: (chapter: Chapter) => void
  onShow: (chapter: Chapter) => void
  onClose: () => void
}

export function StoryCard({ year, holding, onJump, onShow, onClose }: Props) {
  const i = chapterAt(year)
  const c = CHAPTERS[i]
  const people = populationForYear(c.year)

  return (
    <section className="story" aria-label="The story of New York" aria-live="polite">
      {/* the key restarts the fade-in each time a new chapter arrives */}
      <div key={i} className="story-body">
        <div className="story-meta">
          <span className="story-year">{c.year}</span>
          <span>
            {people > 0 ? `${formatPopulation(people)} people` : 'Before the city'}
          </span>
          <span className="story-count">
            {i + 1} / {CHAPTERS.length}
          </span>
        </div>
        <h2>{c.title}</h2>
        <p>{c.text}</p>
        {holding && <div className="story-hold" />}
      </div>
      <div className="story-actions">
        <button
          onClick={() => onJump(CHAPTERS[i - 1])}
          disabled={i === 0}
          aria-label="Previous chapter"
          title="Previous chapter"
        >
          ‹
        </button>
        <button onClick={() => onShow(c)} title="Fly the camera to where this happened.">Show me</button>
        <button
          onClick={() => onJump(CHAPTERS[i + 1])}
          disabled={i === CHAPTERS.length - 1}
          aria-label="Next chapter"
          title="Next chapter"
        >
          ›
        </button>
        <button className="story-close" onClick={onClose} aria-label="Hide the story" title="Hide the story">
          ✕
        </button>
      </div>
    </section>
  )
}
