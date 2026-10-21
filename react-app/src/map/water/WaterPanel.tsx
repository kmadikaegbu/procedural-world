import { WATER_DEFAULTS, WATER_SLIDERS, type WaterSettings } from './settings'

/**
 * UI PANEL — the Water section at the bottom of the Weather tab. Wind and rain
 * from the weather above it already change the water; these set its look.
 */
export function WaterPanel({
  settings,
  setSettings,
}: {
  settings: WaterSettings
  setSettings: (update: (s: WaterSettings) => WaterSettings) => void
}) {
  return (
    <>
      <div className="panel-title">Water</div>

      {WATER_SLIDERS.map((sl) => (
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
          <em>{settings[sl.key].toFixed(sl.step >= 1 ? 0 : sl.step >= 0.1 ? 1 : 2)}</em>
        </label>
      ))}

      <label className="row" title="Colour of the water where it's shallow.">
        <span>Shallow</span>
        <input
          type="color"
          value={settings.shallowColor}
          onChange={(e) => setSettings((s) => ({ ...s, shallowColor: e.target.value }))}
        />
      </label>
      <label className="row" title="Colour of the water where it's deep.">
        <span>Deep</span>
        <input
          type="color"
          value={settings.deepColor}
          onChange={(e) => setSettings((s) => ({ ...s, deepColor: e.target.value }))}
        />
      </label>

      <div className="panel-actions">
        <button onClick={() => setSettings(() => WATER_DEFAULTS)} title="Back to the default water.">
          Reset water
        </button>
      </div>
      <p className="hint-text">
        Wind makes the waves taller and sharper; rain adds ripple rings. Waves
        shrink and foam up where the water gets shallow.
      </p>
    </>
  )
}
