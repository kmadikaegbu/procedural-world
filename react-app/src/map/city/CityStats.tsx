import { TIMELINE_MAX, TIMELINE_MIN } from '../timeline'
import { bridgesOpenBy } from './bridges'
import { buildingsAt, roadKmAt } from './layout'
import {
  formatPopulation,
  POPULATION,
  POPULATION_DATA_END,
  POPULATION_MAX,
  populationForYear,
} from './population'

const W = 240
const H = 56

const px = (year: number) => ((year - TIMELINE_MIN) / (TIMELINE_MAX - TIMELINE_MIN)) * W
const py = (people: number) => H - 4 - (people / POPULATION_MAX) * (H - 10)

/** Population curve with the current year marked, and what has been built so far. */
export function CityStats({ year }: { year: number }) {
  const people = populationForYear(year)
  const dataPoints = POPULATION.filter(([y]) => y <= POPULATION_DATA_END)
  const line = dataPoints.map(([y, p]) => `${px(y).toFixed(1)},${py(p).toFixed(1)}`).join(' ')
  const last = dataPoints[dataPoints.length - 1]
  const future = `${px(last[0]).toFixed(1)},${py(last[1]).toFixed(1)} ${px(2050).toFixed(1)},${py(POPULATION_MAX).toFixed(1)} ${px(TIMELINE_MAX).toFixed(1)},${py(POPULATION_MAX).toFixed(1)}`
  const x = px(Math.min(Math.max(year, TIMELINE_MIN), TIMELINE_MAX))

  return (
    <div className="city-stats">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Population of New York City, 1609 to 2100. In ${Math.round(year)}: ${formatPopulation(people)}.`}
      >
        <polyline points={line} fill="none" stroke="var(--accent-cyan)" strokeWidth="1.6" />
        <polyline
          points={future}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.6"
        />
        <line x1={x} x2={x} y1={2} y2={H - 2} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
        <circle cx={x} cy={py(people)} r="2.6" fill="var(--text)" />
      </svg>
      <dl>
        <dt>Population</dt>
        <dd>{people > 0 ? formatPopulation(people) : '—'}</dd>
        <dt>Buildings</dt>
        <dd>{Math.round(buildingsAt(year)).toLocaleString('en-US')}</dd>
        <dt>Bridges open</dt>
        <dd>{bridgesOpenBy(year)}</dd>
        <dt>Streets laid</dt>
        <dd>{Math.round(roadKmAt(year)).toLocaleString('en-US')} km</dd>
      </dl>
    </div>
  )
}
