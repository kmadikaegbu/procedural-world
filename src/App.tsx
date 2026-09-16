import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
} from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Map } from './map/Map'
import { MAX_TREES } from './map/Props'
import { TERRAIN_DEFAULTS, type TerrainParams } from './map/noise'
import NoisyOrb, {
  ORB_NOISE_DEFAULTS,
  type OrbNoiseParams,
} from './NoisyOrb'
import {
  Weather,
  WEATHER_PRESETS,
  type WeatherParams,
  type WeatherKind,
} from './weather/Weather'
import type { Precip } from './weather/presets'
import './App.css'

type ViewMode = '3D' | '2D'
type SceneMode = 'map' | 'orb'

type Vec3 = [number, number, number]

/** Camera + orbit framing differs wildly: the map is 100 units, the orb is ~1. */
const SCENES: Record<
  SceneMode,
  {
    title: string
    subtitle: string
    persp: Vec3
    ortho: Vec3
    zoom: number
    far: number
    target: Vec3
    minDistance: number
    maxDistance: number
    minZoom: number
    maxZoom: number
    groundLocked: boolean
  }
> = {
  map: {
    title: 'Procedural Map',
    subtitle: 'Noise terrain, biomes, trees & weather — all from a seed',
    persp: [46, 44, 92],
    ortho: [0, 90, 0],
    zoom: 6.5,
    far: 400,
    target: [0, 2, 0],
    minDistance: 20,
    maxDistance: 260,
    minZoom: 3,
    maxZoom: 40,
    groundLocked: true,
  },
  orb: {
    title: 'Noise Orb',
    subtitle: 'Perlin + cellular displacement on a sphere',
    persp: [3, 2, 4],
    ortho: [0, 8, 0],
    zoom: 90,
    far: 100,
    target: [0, 0, 0],
    minDistance: 2,
    maxDistance: 20,
    minZoom: 30,
    maxZoom: 400,
    groundLocked: false,
  },
}

const WEATHER_KINDS: WeatherKind[] = [
  'clear',
  'cloudy',
  'rain',
  'snow',
  'storm',
  'fog',
]

const WEATHER_KIND_HINTS: Record<WeatherKind, string> = {
  clear: 'Mostly clear sky, no precipitation.',
  cloudy: 'Heavier overcast, still dry.',
  rain: 'Overcast, foggy, windy, and raining.',
  snow: 'Overcast and snowing, with a gentler wind.',
  storm: 'Maximum cloud cover, fog, wind, and rain.',
  fog: 'Dense fog, dim sun, no precipitation.',
}

function App() {
  const [scene, setScene] = useState<SceneMode>('map')
  const [view, setView] = useState<ViewMode>('3D')
  const [terrain, setTerrain] = useState<TerrainParams>(TERRAIN_DEFAULTS)
  const [orbNoise, setOrbNoise] = useState<OrbNoiseParams>(ORB_NOISE_DEFAULTS)
  const [weather, setWeather] = useState<WeatherParams>(WEATHER_PRESETS.clear)
  const [kind, setKind] = useState<WeatherKind | 'custom'>('clear')
  const [running, setRunning] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [showTrees, setShowTrees] = useState(true)
  const [treeCount, setTreeCount] = useState(400)
  const [scatterSeed, setScatterSeed] = useState(0)
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const cfg = SCENES[scene]

  // keyboard shortcut: "W" toggles wireframe (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key.toLowerCase() === 'w') setWireframe((w) => !w)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const setT = <K extends keyof TerrainParams>(k: K, v: TerrainParams[K]) =>
    setTerrain((t) => ({ ...t, [k]: v }))

  const setO = <K extends keyof OrbNoiseParams>(k: K, v: OrbNoiseParams[K]) =>
    setOrbNoise((o) => ({ ...o, [k]: v }))

  const setW = <K extends keyof WeatherParams>(k: K, v: WeatherParams[K]) => {
    setWeather((w) => ({ ...w, [k]: v }))
    setKind('custom')
  }

  const applyPreset = (k: WeatherKind) => {
    setWeather(WEATHER_PRESETS[k])
    setKind(k)
  }

  // Pausing the simulation freezes the orb's noise animation too. Memoised so
  // NoisyOrb doesn't see a new params object (and re-displace) on every render.
  const orbParams = useMemo<OrbNoiseParams>(
    () => ({
      ...orbNoise,
      speed: running ? orbNoise.speed : 0,
      wireframe,
    }),
    [orbNoise, running, wireframe],
  )

  return (
    <div className="app">
      <div className="canvas-wrap">
        <Canvas shadows>
          {view === '3D' ? (
            <PerspectiveCamera
              key={`p-${scene}`}
              makeDefault
              position={cfg.persp}
              fov={50}
            />
          ) : (
            <OrthographicCamera
              key={`o-${scene}`}
              makeDefault
              position={cfg.ortho}
              zoom={cfg.zoom}
              near={0.1}
              far={cfg.far}
            />
          )}

          {scene === 'map' ? (
            <>
              <Weather params={weather} running={running} />
              <Map
                params={terrain}
                wireframe={wireframe}
                showTrees={showTrees}
                treeCount={treeCount}
                scatterSeed={scatterSeed}
              />
            </>
          ) : (
            <>
              <color attach="background" args={['#0f0f17']} />
              <ambientLight intensity={0.4} />
              <pointLight position={[3, 3, 3]} intensity={40} color="#ffd9b3" />
              <pointLight
                position={[-4, -2, -3]}
                intensity={15}
                color="#e07a5f"
              />
              <NoisyOrb params={orbParams} />
            </>
          )}

          <OrbitControls
            key={`${scene}-${view}`}
            ref={controlsRef}
            enableDamping
            enableRotate={view === '3D'}
            target={cfg.target}
            minDistance={cfg.minDistance}
            maxDistance={cfg.maxDistance}
            minZoom={cfg.minZoom}
            maxZoom={cfg.maxZoom}
            maxPolarAngle={cfg.groundLocked ? Math.PI / 2.05 : Math.PI}
          />
        </Canvas>
      </div>

      <div className="ui-overlay">
        <header>
          <h1 className="site-title">{cfg.title}</h1>
          <p className="site-subtitle">{cfg.subtitle}</p>
        </header>

        <div className="panel">
          <div className="panel-title">Scene</div>
          <div className="segmented">
            <button
              className={scene === 'map' ? 'active' : ''}
              onClick={() => setScene('map')}
              title="The procedural Roosevelt Island terrain — noise, biomes, trees, weather."
            >
              Map
            </button>
            <button
              className={scene === 'orb' ? 'active' : ''}
              onClick={() => setScene('orb')}
              title="A noise-displaced sphere — Perlin + cellular bumps, its own controls below."
            >
              Orb
            </button>
          </div>

          <div className="panel-title">Simulation</div>
          <div className="segmented">
            <button
              className={running ? 'active' : ''}
              onClick={() => setRunning(true)}
              title="Resume time-based motion: rain/snow falling, cloud drift, orb noise animation."
            >
              ▶ Running
            </button>
            <button
              className={!running ? 'active' : ''}
              onClick={() => setRunning(false)}
              title="Freeze rain/snow, cloud drift, and orb noise animation in place. Terrain sliders still work."
            >
              ⏸ Paused
            </button>
          </div>
          <p className="hint-text">
            {scene === 'map'
              ? 'Pauses rain/snow & cloud drift. Terrain, seed and biomes still respond live — the noise stack keeps driving the height field.'
              : 'Pauses the orb’s noise animation. The sliders still reshape it while frozen.'}
          </p>

          <div className="panel-title">View</div>
          <div className="segmented">
            <button
              className={view === '3D' ? 'active' : ''}
              onClick={() => setView('3D')}
              title="Free-orbiting perspective camera — rotate, pan, and zoom."
            >
              3D
            </button>
            <button
              className={view === '2D' ? 'active' : ''}
              onClick={() => setView('2D')}
              title="Top-down orthographic camera, rotation locked — good for reading the shape/layout."
            >
              2D
            </button>
          </div>

          {scene === 'map' && (
            <>
              <div className="panel-title">Weather</div>
              <div className="preset-grid">
                {WEATHER_KINDS.map((k) => (
                  <button
                    key={k}
                    className={kind === k ? 'active' : ''}
                    onClick={() => applyPreset(k)}
                    title={`${WEATHER_KIND_HINTS[k]} Sets sun, cloud, fog, wind, and precipitation together.`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <label
                className="row"
                title="Sun height above the horizon. 0 = sunrise/sunset, 1 = overhead noon, below 0 = night (stars appear). Also drives sun colour and shadow intensity."
              >
                <span>Sun</span>
                <input
                  type="range"
                  min={-0.15}
                  max={1}
                  step={0.01}
                  value={weather.sunElevation}
                  onChange={(e) => setW('sunElevation', Number(e.target.value))}
                />
                <em>{weather.sunElevation.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Cloud cover, 0 = clear sky to 1 = fully overcast. Higher values also dim and thicken the sun's haze."
              >
                <span>Cloud</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weather.cloudCover}
                  onChange={(e) => setW('cloudCover', Number(e.target.value))}
                />
                <em>{weather.cloudCover.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Fog density. Higher values shorten visibility and fade the map's edges."
              >
                <span>Fog</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weather.fogDensity}
                  onChange={(e) => setW('fogDensity', Number(e.target.value))}
                />
                <em>{weather.fogDensity.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Horizontal drift speed applied to falling rain/snow particles."
              >
                <span>Wind</span>
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={weather.wind}
                  onChange={(e) => setW('wind', Number(e.target.value))}
                />
                <em>{weather.wind.toFixed(1)}</em>
              </label>

              <div className="segmented">
                {(['none', 'rain', 'snow'] as Precip[]).map((p) => (
                  <button
                    key={p}
                    className={weather.precip === p ? 'active' : ''}
                    onClick={() => setW('precip', p)}
                    title={
                      p === 'none'
                        ? 'No precipitation.'
                        : p === 'rain'
                          ? 'Falling rain — small, fast, near-transparent streaks.'
                          : 'Falling snow — larger, slower flakes with a gentle sideways sway.'
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>

              <label
                className="row"
                title="Precipitation intensity — how many particles fall and how visible they are. 0 hides them even if rain/snow is selected."
              >
                <span>Amount</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weather.precipIntensity}
                  onChange={(e) =>
                    setW('precipIntensity', Number(e.target.value))
                  }
                />
                <em>{weather.precipIntensity.toFixed(2)}</em>
              </label>

              <div className="panel-title">Terrain</div>

              <label
                className="row"
                title="Jumps to a completely different noise pattern — the coastline and every hill change at once."
              >
                <span>Seed</span>
                <input
                  type="range"
                  min={1}
                  max={200}
                  step={1}
                  value={terrain.seed}
                  onChange={(e) => setT('seed', Number(e.target.value))}
                />
                <em>{terrain.seed}</em>
              </label>

              <label
                className="row"
                title="Slides continuously through the same noise pattern along X — the coastline stays fixed, the hills underneath shift."
              >
                <span>Offset X</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={0.5}
                  value={terrain.offsetX}
                  onChange={(e) => setT('offsetX', Number(e.target.value))}
                />
                <em>{terrain.offsetX.toFixed(1)}</em>
              </label>

              <label
                className="row"
                title="Same as Offset X, but along Z (north–south)."
              >
                <span>Offset Z</span>
                <input
                  type="range"
                  min={-50}
                  max={50}
                  step={0.5}
                  value={terrain.offsetZ}
                  onChange={(e) => setT('offsetZ', Number(e.target.value))}
                />
                <em>{terrain.offsetZ.toFixed(1)}</em>
              </label>

              <p className="hint-text">
                Seed jumps to a new noise pattern; Offset slides continuously
                through the same one — coastline stays put, the hills
                underneath shift.
              </p>

              <label
                className="row"
                title="Maximum terrain height, in world units. Also rescales where the sand/grass/rock/snow bands sit, so the biome mix holds together at any setting."
              >
                <span>Amplitude</span>
                <input
                  type="range"
                  min={1}
                  max={16}
                  step={0.5}
                  value={terrain.amplitude}
                  onChange={(e) => setT('amplitude', Number(e.target.value))}
                />
                <em>{terrain.amplitude.toFixed(1)}</em>
              </label>

              <label
                className="row"
                title="Base noise scale. Low = broad, gentle hills. High = small, busy bumps."
              >
                <span>Frequency</span>
                <input
                  type="range"
                  min={0.005}
                  max={0.12}
                  step={0.005}
                  value={terrain.frequency}
                  onChange={(e) => setT('frequency', Number(e.target.value))}
                />
                <em>{terrain.frequency.toFixed(3)}</em>
              </label>

              <label
                className="row"
                title="How many noise layers are summed. More octaves add finer detail on top of the big shapes, at the cost of regeneration speed."
              >
                <span>Octaves</span>
                <input
                  type="range"
                  min={1}
                  max={7}
                  step={1}
                  value={terrain.octaves}
                  onChange={(e) => setT('octaves', Number(e.target.value))}
                />
                <em>{terrain.octaves}</em>
              </label>

              <label
                className="row"
                title="How much each finer octave contributes. Higher values make the extra detail rougher and more prominent."
              >
                <span>Persistence</span>
                <input
                  type="range"
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  value={terrain.persistence}
                  onChange={(e) => setT('persistence', Number(e.target.value))}
                />
                <em>{terrain.persistence.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Folds the noise so valleys become sharp ridges — turns rolling hills into jagged mountains."
              >
                <span>Ridged</span>
                <input
                  type="checkbox"
                  checked={terrain.ridged}
                  onChange={(e) => setT('ridged', e.target.checked)}
                />
              </label>

              <div className="panel-title">Island</div>

              <label
                className="row"
                title="Mask the terrain into the Roosevelt Island outline. Turn off to see the raw square noise field with no coastline."
              >
                <span>Roosevelt Is.</span>
                <input
                  type="checkbox"
                  checked={terrain.island}
                  onChange={(e) => setT('island', e.target.checked)}
                />
              </label>

              <label
                className="row"
                title="Scales the island's width. Lower = thinner and more true-to-life; higher = fatter, so terrain detail reads more easily."
              >
                <span>Width</span>
                <input
                  type="range"
                  min={0.4}
                  max={2}
                  step={0.05}
                  value={terrain.islandWidth}
                  disabled={!terrain.island}
                  onChange={(e) => setT('islandWidth', Number(e.target.value))}
                />
                <em>{terrain.islandWidth.toFixed(2)}</em>
              </label>

              <p className="hint-text">
                0.45 ≈ the real 13:1 proportions; higher fattens it so the
                terrain detail reads.
              </p>

              <div className="panel-title">Trees</div>

              <label
                className="row"
                title="Show or hide the forest entirely."
              >
                <span>Show trees</span>
                <input
                  type="checkbox"
                  checked={showTrees}
                  onChange={(e) => setShowTrees(e.target.checked)}
                />
              </label>

              <label
                className="row"
                title="How many trees are drawn, out of a fixed pool of possible spots. Cheap to drag — it only changes how many of the already-computed positions are shown."
              >
                <span>Count</span>
                <input
                  type="range"
                  min={0}
                  max={MAX_TREES}
                  step={25}
                  value={treeCount}
                  disabled={!showTrees}
                  onChange={(e) => setTreeCount(Number(e.target.value))}
                />
                <em>{treeCount}</em>
              </label>

              <div className="panel-actions">
                <button
                  disabled={!showTrees}
                  onClick={() => setScatterSeed((s) => s + 1)}
                  title="Re-roll where trees can grow, without changing the terrain itself."
                >
                  Replant
                </button>
              </div>

              <div className="panel-title">Detail</div>

              <label
                className="row"
                title="Grid density of the terrain mesh. Higher looks smoother but takes longer to regenerate on every change."
              >
                <span>Resolution</span>
                <input
                  type="range"
                  min={20}
                  max={320}
                  step={10}
                  value={terrain.resolution}
                  onChange={(e) => setT('resolution', Number(e.target.value))}
                />
                <em>{terrain.resolution}</em>
              </label>
            </>
          )}

          {scene === 'orb' && (
            <>
              <div className="panel-title">Orb Perlin Noise</div>

              <label
                className="row"
                title="How far the surface bulges in and out."
              >
                <span>Amplitude</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={orbNoise.amplitude}
                  onChange={(e) => setO('amplitude', Number(e.target.value))}
                />
                <em>{orbNoise.amplitude.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="How many bumps fit around the orb. Higher is busier/smaller bumps."
              >
                <span>Frequency</span>
                <input
                  type="range"
                  min={0.3}
                  max={5}
                  step={0.1}
                  value={orbNoise.frequency}
                  onChange={(e) => setO('frequency', Number(e.target.value))}
                />
                <em>{orbNoise.frequency.toFixed(1)}</em>
              </label>

              <label
                className="row"
                title="Animation speed of the noise. 0 freezes the current shape."
              >
                <span>Speed</span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={orbNoise.speed}
                  onChange={(e) => setO('speed', Number(e.target.value))}
                />
                <em>{orbNoise.speed.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Layers of Perlin detail summed together. More = finer surface detail."
              >
                <span>Octaves</span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={orbNoise.octaves}
                  onChange={(e) => setO('octaves', Number(e.target.value))}
                />
                <em>{orbNoise.octaves}</em>
              </label>

              <label
                className="row"
                title="How much each finer octave contributes to the surface."
              >
                <span>Persistence</span>
                <input
                  type="range"
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  value={orbNoise.persistence}
                  onChange={(e) => setO('persistence', Number(e.target.value))}
                />
                <em>{orbNoise.persistence.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Jumps to a different Perlin noise pattern."
              >
                <span>Seed</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={orbNoise.seed}
                  onChange={(e) => setO('seed', Number(e.target.value))}
                />
                <em>{orbNoise.seed}</em>
              </label>

              <div className="panel-title">Cellular (Worley) Noise</div>

              <label
                className="row"
                title="Strength of the cellular bump/crack layer, added on top of the Perlin layer. 0 turns it off."
              >
                <span>Amplitude</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={orbNoise.cellularAmplitude}
                  onChange={(e) =>
                    setO('cellularAmplitude', Number(e.target.value))
                  }
                />
                <em>{orbNoise.cellularAmplitude.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Size of the cells. Higher = many small cells; lower = fewer, larger ones."
              >
                <span>Frequency</span>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.1}
                  value={orbNoise.cellularFrequency}
                  onChange={(e) =>
                    setO('cellularFrequency', Number(e.target.value))
                  }
                />
                <em>{orbNoise.cellularFrequency.toFixed(1)}</em>
              </label>

              <label
                className="row"
                title="0 = an even grid of cells (regular bubbles). 1 = cell centres scattered randomly, for an organic look."
              >
                <span>Jitter</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={orbNoise.cellularJitter}
                  onChange={(e) =>
                    setO('cellularJitter', Number(e.target.value))
                  }
                />
                <em>{orbNoise.cellularJitter.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Off: rounded domes at each cell centre. On: grooves/cracks along the cell edges instead."
              >
                <span>Crack mode</span>
                <input
                  type="checkbox"
                  checked={orbNoise.cellularCracks}
                  onChange={(e) => setO('cellularCracks', e.target.checked)}
                />
              </label>

              <div className="panel-title">Gradient</div>

              <label
                className="row"
                title="Colour mapped onto the lowest points of the displaced surface."
              >
                <span>Low color</span>
                <input
                  type="color"
                  value={orbNoise.colorLow}
                  onChange={(e) => setO('colorLow', e.target.value)}
                />
              </label>

              <label
                className="row"
                title="Colour mapped onto the highest points of the displaced surface."
              >
                <span>High color</span>
                <input
                  type="color"
                  value={orbNoise.colorHigh}
                  onChange={(e) => setO('colorHigh', e.target.value)}
                />
              </label>

              <label
                className="row"
                title="Shapes the colour ramp between Low and High. Below 1 spreads the high colour further down; above 1 concentrates it near the very peaks."
              >
                <span>Contrast</span>
                <input
                  type="range"
                  min={0.3}
                  max={3}
                  step={0.1}
                  value={orbNoise.gradientContrast}
                  onChange={(e) =>
                    setO('gradientContrast', Number(e.target.value))
                  }
                />
                <em>{orbNoise.gradientContrast.toFixed(1)}</em>
              </label>
            </>
          )}

          <label
            className="row"
            title="Show the current scene as a wireframe mesh instead of solid. Shortcut: press W anywhere (except while typing in a field)."
          >
            <span>Wireframe (W)</span>
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
          </label>

          <div className="panel-actions">
            {scene === 'map' ? (
              <button
                onClick={() => setT('seed', Math.floor(Math.random() * 200) + 1)}
                title="Pick a new random terrain seed."
              >
                New seed
              </button>
            ) : (
              <button
                onClick={() => setO('seed', Math.floor(Math.random() * 100))}
                title="Pick a new random orb noise seed."
              >
                New seed
              </button>
            )}
            <button
              onClick={() => controlsRef.current?.reset()}
              title="Reset the camera to its starting position and zoom."
            >
              Reset view
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
