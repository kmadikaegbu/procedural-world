import { ISLAND_LIFE_DEFAULTS, ROLE_INFO, TRASH_COLOR, type IslandLifeSettings } from './settings'
import { ROLES, type IslandLifeStats } from './sim'
import { clockText, jumpTo, MOMENTS } from './clock'
import { TOWN_OPENS } from './places'

const fmt = (n: number) => n.toLocaleString('en-US')

/** Today's (and yesterday's) electricity, MW, through the day. */
function PowerChart({ stats }: { stats: IslandLifeStats }) {
  const W = 240
  const H = 54
  const max = Math.max(1, ...stats.today.filter(Number.isFinite), ...stats.yesterday.filter(Number.isFinite)) * 1.1
  const line = (v: number[]) =>
    v
      .map((y, k) => (Number.isFinite(y) ? `${((k / 143) * W).toFixed(1)},${(H - 4 - (y / max) * (H - 10)).toFixed(1)}` : null))
      .filter(Boolean)
      .join(' ')
  const now = (stats.minute / 1440) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Electricity the island draws: ${stats.powerMW.toFixed(1)} MW now.`}>
      <polyline points={line(stats.yesterday)} fill="none" stroke="var(--accent-cyan)" strokeOpacity="0.3" strokeWidth="1.2" />
      <polyline points={line(stats.today)} fill="none" stroke="var(--accent-cyan)" strokeWidth="1.6" />
      <line x1={now} x2={now} y1={2} y2={H - 2} stroke="currentColor" strokeOpacity="0.4" />
      {[6, 12, 18].map((h) => (
        <text key={h} x={(h / 24) * W} y={H} fontSize="7" fill="currentColor" opacity="0.5" textAnchor="middle">
          {h}:00
        </text>
      ))}
    </svg>
  )
}

/**
 * UI PANEL — the People tab: Roosevelt Island run as a city simulation.
 */
export function IslandLifePanel({
  settings,
  setSettings,
  stats,
  year,
}: {
  settings: IslandLifeSettings
  setSettings: (update: (s: IslandLifeSettings) => IslandLifeSettings) => void
  stats: IslandLifeStats | null
  year: number
}) {
  const open = year >= TOWN_OPENS
  return (
    <>
      <div className="panel-title">Island life</div>

      <div className="segmented">
        <button className={settings.show ? 'active' : ''} onClick={() => setSettings((s) => ({ ...s, show: true }))} title="Show and run Roosevelt Island's people.">
          People on
        </button>
        <button className={!settings.show ? 'active' : ''} onClick={() => setSettings((s) => ({ ...s, show: false }))} title="Hide the people and stop the simulation.">
          People off
        </button>
      </div>

      {!open && (
        <p className="hint-text">
          The island's town opens in {TOWN_OPENS}, with the first apartment towers on Main Street and the Tramway. Move the
          History Timeline to {TOWN_OPENS} or later to see it.
        </p>
      )}

      {open && settings.show && stats && (
        <>
          <div className="life-clock">
            <strong>{clockText(stats.minute)}</strong> <span>day {stats.day + 1}</span>
          </div>
          <div className="preset-grid">
            {MOMENTS.map((mo) => (
              <button key={mo.label} onClick={() => jumpTo(mo.minute)} title={mo.title}>
                {mo.label}
              </button>
            ))}
          </div>
        </>
      )}

      <label className="row" title="Simulated minutes that pass each second. At 3, a day takes 8 minutes.">
        <span>Minutes / s</span>
        <input type="range" min={0.5} max={30} step={0.5} value={settings.speed} onChange={(e) => setSettings((s) => ({ ...s, speed: Number(e.target.value) }))} />
        <em>{settings.speed}</em>
      </label>
      <label className="row" title="How much a person may be enlarged when far from the camera, so they stay visible. Up close they are drawn at their true height beside the buildings and trees. 1 = never enlarged.">
        <span>Size ×</span>
        <input type="range" min={1} max={20} step={1} value={settings.size} onChange={(e) => setSettings((s) => ({ ...s, size: Number(e.target.value) }))} />
        <em>{settings.size}</em>
      </label>
      <label className="row" title="Draw the AVAC trash tubes under Main Street with the trash moving in them, and label each station with its queue.">
        <span>Show flows</span>
        <input type="checkbox" checked={settings.flows} onChange={(e) => setSettings((s) => ({ ...s, flows: e.target.checked }))} />
      </label>

      {open && settings.show && stats && (
        <div className="hint-text">
          <strong>
            {fmt(stats.onIsland)} people on the island, {fmt(stats.offIsland)} away
          </strong>
          <div style={{ marginTop: 4 }}>
            {fmt(stats.doing.in)} indoors · {fmt(stats.doing.walk)} walking · {fmt(stats.doing.park)} in the parks ·{' '}
            {fmt(stats.doing.queue)} waiting
          </div>
          <div style={{ marginTop: 6 }}>
            {ROLES.filter((r) => stats.roles[r] > 0).map((r) => (
              <span key={r} title={ROLE_INFO[r].title} style={{ display: 'inline-block', marginRight: 8, whiteSpace: 'nowrap' }}>
                <span style={{ color: ROLE_INFO[r].color }}>●</span> {ROLE_INFO[r].label} {fmt(stats.roles[r])}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Getting on and off</strong>
            {stats.lines
              .filter((l) => l.open)
              .map((l) => (
                <div key={l.short}>
                  {l.short}: {fmt(l.waiting)} waiting, {fmt(l.arriving)} on the way · {fmt(l.ridersToday)} rides today
                  {l.ridersYesterday > 0 && ` (${fmt(l.ridersYesterday)} yesterday)`}
                </div>
              ))}
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>
              <span style={{ color: TRASH_COLOR }}>●</span> Trash
            </strong>
            <div>
              {(stats.trash.collectedToday / 1000).toFixed(1)} t collected today
              {stats.trash.collectedYesterday > 0 && ` (${(stats.trash.collectedYesterday / 1000).toFixed(1)} t yesterday)`},{' '}
              {Math.round(stats.trash.inChutes)} kg waiting in the chutes
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <strong>Electricity: {stats.powerMW.toFixed(1)} MW</strong>
            <PowerChart stats={stats} />
          </div>
          <div>{fmt(stats.shopVisits)} shop visits today</div>
        </div>
      )}

      <div className="panel-actions">
        <button onClick={() => setSettings(() => ISLAND_LIFE_DEFAULTS)} title="Back to the default settings.">
          Reset settings
        </button>
      </div>

      <p className="hint-text">
        Roosevelt Island as a city simulation, after Stone Librande's SimCity diagrams. Units (homes, workplaces, parks,
        stations) are joined by paths (Main Street, the Tram, the subway, the bus, the trash tubes). Agents follow daily
        schedules, and each one stands for ten people. Resources flow between the units. Residents come from the
        buildings' size, scaled to the 2020 census (11,722). The Tram's cabins carry 110, so queues build at the rush
        hours. Trash goes by pneumatic tube to the plant at the north end, as the island's real AVAC system has done
        since 1975 (drawn at a tenth of its real speed, so you can follow it). The rates for trash and electricity are stylized: they show the shape of a day, not measured
        figures. Every day is a weekday.
      </p>
    </>
  )
}
