import { WILDLIFE_DEFAULTS, WILDLIFE_SLIDERS, type WildlifeSettings } from './settings'
import { STATE_COLOR } from './shapes'
import type { AgentState, Species, WildlifeStats } from './sim'

const NAMES: Record<Species, string> = { bird: 'Birds', deer: 'Deer', fox: 'Foxes' }

/** What each species can be doing, in the order the readout lists them. */
const STATES: Record<Species, AgentState[]> = {
  bird: ['flock', 'drink', 'perch', 'displaced', 'leaving'],
  deer: ['graze', 'drink', 'alert', 'flee', 'rest', 'displaced', 'leaving'],
  fox: ['wander', 'drink', 'stalk', 'hunt', 'eat', 'rest', 'displaced', 'leaving'],
}

/**
 * UI PANEL — the Wildlife tab: how many animals the land holds, how big they
 * are drawn, and a live count of what each one is doing.
 */
export function WildlifePanel({
  settings,
  setSettings,
  stats,
  onRestart,
}: {
  settings: WildlifeSettings
  setSettings: (update: (s: WildlifeSettings) => WildlifeSettings) => void
  stats: WildlifeStats | null
  onRestart: () => void
}) {
  return (
    <>
      <div className="panel-title">Wildlife</div>

      <div className="segmented">
        <button
          className={settings.show ? 'active' : ''}
          onClick={() => setSettings((s) => ({ ...s, show: true }))}
          title="Show the birds, deer and foxes."
        >
          Animals on
        </button>
        <button
          className={!settings.show ? 'active' : ''}
          onClick={() => setSettings((s) => ({ ...s, show: false }))}
          title="Hide the animals and stop simulating them."
        >
          Animals off
        </button>
      </div>

      {WILDLIFE_SLIDERS.map((sl) => (
        <label key={sl.key} className="row" title={sl.title}>
          <span>{sl.label}</span>
          <input
            type="range"
            min={sl.min}
            max={sl.max}
            step={sl.step}
            value={settings[sl.key]}
            onChange={(e) => {
              const v = Number(e.target.value)
              setSettings((s) => ({ ...s, [sl.key]: v }))
            }}
          />
          <em>{settings[sl.key]}</em>
        </label>
      ))}

      <label
        className="row"
        title="Colour every animal by what it's doing right now, and draw each fox's cone of vision: it only sees deer inside it."
      >
        <span>Show states</span>
        <input
          type="checkbox"
          checked={settings.showStates}
          onChange={(e) => setSettings((s) => ({ ...s, showStates: e.target.checked }))}
        />
      </label>

      <label
        className="row"
        title="Deer and foxes leave footprints that fade after a while. Follow them to see where the animals have been."
      >
        <span>Tracks</span>
        <input
          type="checkbox"
          checked={settings.tracks}
          onChange={(e) => setSettings((s) => ({ ...s, tracks: e.target.checked }))}
        />
      </label>

      <div className="panel-actions">
        <button onClick={onRestart} title="Start the population over, filled to what the wild land holds now.">
          Restart
        </button>
        <button onClick={() => setSettings(() => WILDLIFE_DEFAULTS)} title="Back to the default settings.">
          Reset settings
        </button>
      </div>

      {stats && settings.show && (
        <div className="hint-text">
          <strong>{Math.round(stats.wildShare * 100)}% of the land is still wild.</strong>
          {(Object.keys(NAMES) as Species[]).map((sp) => (
            <div key={sp} style={{ marginTop: 6 }}>
              {NAMES[sp]}: {stats.totals[sp]} of {stats.capacity[sp]} the land holds
              <br />
              {STATES[sp]
                .filter((st) => (stats.counts[sp][st] ?? 0) > 0)
                .map((st) => (
                  <span key={st} style={{ marginRight: 8, whiteSpace: 'nowrap' }}>
                    <span style={{ color: STATE_COLOR[st] }}>●</span> {st} {stats.counts[sp][st]}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}

      <p className="hint-text">
        Inspired by the wildlife of theHunter: Call of the Wild. Birds flock by
        three local rules (Reynolds' boids). Deer live in herds with a leader
        and notice foxes by sight, by smell (a plume drifting downwind) and by
        sound; as they grow more aware they freeze, then bolt. Foxes wander,
        stalk (coming in from downwind) and hunt, eat, rest, and starve if they
        catch nothing. All of them get thirsty and go to the shore to drink,
        and deer bed down at night, in rain and in the midday heat, and leave
        tracks. They also follow the world: they
        can't cross water, climb cliffs or enter paved land; at night the deer
        bed down and the birds roost; rain and storms send the birds to the
        ground; the birds migrate away in autumn and winter. Drag the History
        Timeline to watch the wild shrink to Roosevelt Island. Time is sped
        up, and the animals are drawn {settings.size}× bigger than real.
      </p>
    </>
  )
}
