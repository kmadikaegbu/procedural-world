import { GRASS_DEFAULTS, GRASS_SLIDERS, type GrassSettings } from './settings'

/**
 * UI PANEL — the Grass section at the bottom of the Terrain tab. The season
 * (Props tab) and the weather (wind, rain, snow) also change the grass.
 */
export function GrassPanel({
  settings,
  setSettings,
}: {
  settings: GrassSettings
  setSettings: (update: (s: GrassSettings) => GrassSettings) => void
}) {
  const color = (key: 'lushColor' | 'dryColor' | 'soilColor', label: string, title: string) => (
    <label className="row" title={title}>
      <span>{label}</span>
      <input
        type="color"
        value={settings[key]}
        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
      />
    </label>
  )

  return (
    <>
      <div className="panel-title">Grass</div>

      {GRASS_SLIDERS.map((sl) => (
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
          <em>{settings[sl.key].toFixed(2)}</em>
        </label>
      ))}

      {color('lushColor', 'Lush', 'Colour of well-watered grass.')}
      {color('dryColor', 'Dry', 'Colour of parched, straw-like grass.')}
      {color('soilColor', 'Soil', 'Colour of the bare ground on steep slopes.')}

      <div className="panel-actions">
        <button onClick={() => setSettings(() => GRASS_DEFAULTS)} title="Back to the default grass.">
          Reset grass
        </button>
      </div>
      <p className="hint-text">
        Season (Props tab) yellows or freshens the grass; wind rolls sheen across
        it, rain darkens it, snow covers it.
      </p>
    </>
  )
}
