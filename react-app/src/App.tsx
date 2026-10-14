import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  PerspectiveCamera,
  OrthographicCamera,
} from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { MOUSE } from 'three'
import { Map } from './map/Map'
import { VoxelMap } from './map/VoxelMap'
import { Minimap, type InsetMode } from './map/Minimap'
import { ScatterMaskBrush } from './map/trees/ScatterMaskBrush'
import { TreePanel } from './map/trees/TreePanel'
import { useTreeControls } from './map/trees/useTreeControls'
import { TERRAIN_DEFAULTS, erodeTerrain, type TerrainParams } from './map/noise'
import { TerraformBrush } from './map/TerraformBrush'
import type { BrushTool, TerrainEdits } from './map/terraform'
import {
  TIMELINE_MIN,
  TIMELINE_MAX,
  TIMELINE_DEFAULT,
  TIMELINE_YEARS_PER_SECOND,
  seaLevelForYear,
} from './map/timeline'
import NoisyOrb, {
  ORB_NOISE_DEFAULTS,
  type OrbNoiseParams,
} from './orb/NoisyOrb'
import {
  Weather,
  WEATHER_PRESETS,
  type WeatherParams,
  type WeatherKind,
} from './weather/Weather'
import type { Precip } from './weather/presets'
import './App.css'

type ViewMode = '3D' | '2D'
type SceneMode = 'map' | 'voxel' | 'orb'

type Vec3 = [number, number, number]

// how many strokes Undo can step back through
const UNDO_LIMIT = 30

// Default orbit mapping, and the one used while sculpting: the left button
// belongs to the brush, so rotate moves to the right button. Wheel zoom is
// unchanged. (-1 is OrbitControls' "no action" for a button.)
const ORBIT_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
}
const SCULPT_BUTTONS = {
  LEFT: -1 as MOUSE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.ROTATE,
}

const BRUSH_TOOLS: { tool: BrushTool; label: string; hint: string }[] = [
  { tool: 'raise', label: 'Raise', hint: 'Push the land up under the brush. Drag in the river to build new land.' },
  { tool: 'lower', label: 'Lower', hint: 'Dig the land down under the brush. Dig below sea level to cut channels and bays.' },
  { tool: 'flatten', label: 'Flatten', hint: 'Level everything under the brush to the height where you started the stroke. Good for plateaus, roads, and building pads.' },
]

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
    title: 'Roosevelt Island',
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
  voxel: {
    title: 'Roosevelt Island — Voxel',
    subtitle: 'The same terrain, blocked out as cubes instead of a smooth mesh',
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
  const [showMinimap, setShowMinimap] = useState(true)
  const [insetMode, setInsetMode] = useState<InsetMode>('terrain')
  const [terrainState, setTerrain] = useState<TerrainParams>(TERRAIN_DEFAULTS)
  // erosion is simulated, not a formula, so it's computed here and handed down
  // as a grid. It depends on the procedural params only — not sea level, edits
  // or resolution — so the climate timeline and sculpting don't re-run it.
  const erosionGrid = useMemo(
    () => erodeTerrain(terrainState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      terrainState.erosion,
      terrainState.seed,
      terrainState.amplitude,
      terrainState.frequency,
      terrainState.octaves,
      terrainState.persistence,
      terrainState.ridged,
      terrainState.noiseBlend,
      terrainState.redistribution,
      terrainState.terraces,
      terrainState.island,
      terrainState.islandWidth,
      terrainState.offsetX,
      terrainState.offsetZ,
    ],
  )
  const terrain = useMemo(
    () => ({ ...terrainState, erosionGrid }),
    [terrainState, erosionGrid],
  )
  const [orbNoise, setOrbNoise] = useState<OrbNoiseParams>(ORB_NOISE_DEFAULTS)
  const [weather, setWeather] = useState<WeatherParams>(WEATHER_PRESETS.clear)
  const [kind, setKind] = useState<WeatherKind | 'custom'>('clear')
  const [running, setRunning] = useState(true)
  const [wireframe, setWireframe] = useState(false)
  const [mapTab, setMapTab] = useState<
    'terrain' | 'sculpt' | 'weather' | 'props'
  >('terrain')
  const [brushTool, setBrushTool] = useState<BrushTool>('raise')
  const [brushRadius, setBrushRadius] = useState(6)
  const [brushStrength, setBrushStrength] = useState(3)
  const [editHistory, setEditHistory] = useState<(TerrainEdits | null)[]>([])
  // everything about the trees: placement, shapes, LOD, look, season, ivy
  const trees = useTreeControls()
  const { forest, onPlaced, onLodStats, scatter, mask, setMask, maskTool, maskRadius } = trees
  const [timelineYear, setTimelineYear] = useState(TIMELINE_DEFAULT)
  const [timelinePlaying, setTimelinePlaying] = useState(false)
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const cfg = SCENES[scene]
  const isMapLike = scene === 'map' || scene === 'voxel'
  // the brush is live exactly while the Sculpt tab is open
  const sculpting = isMapLike && mapTab === 'sculpt'
  // likewise for painting the planting mask, on the Props tab
  const painting = isMapLike && mapTab === 'props' && maskTool !== 'off'
  const showingIsland = isMapLike && terrain.island
  const headerTitle = isMapLike
    ? (terrain.island ? 'Roosevelt Island' : 'Procedural World') +
      (scene === 'voxel' ? ' — Voxel' : '')
    : cfg.title

  // Subtitle lists only what's actually present right now, not a fixed blurb.
  // terrain is always on (no toggle removes it); the rest track a real state:
  // biomes read from the colored surface, so wireframe hides them; trees and
  // weather (rain/snow) have their own on/off switches.
  const envItems = [
    { label: 'terrain', active: true },
    { label: 'biomes', active: !wireframe },
    { label: 'trees', active: forest.show },
    { label: 'weather', active: weather.precip !== 'none' },
  ]
    .filter((i) => i.active)
    .map((i) => i.label)

  // gates the ground's snow-accumulation animation — see Terrain.tsx
  const isSnowing = weather.precip === 'snow'

  const headerSubtitle = isMapLike
    ? envItems.length <= 1
        ? envItems.join('')
        : `${envItems.slice(0, -1).join(', ')} & ${envItems[envItems.length - 1]}`
      : cfg.subtitle

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

  // the Year slider is a meta-control: it just drives the existing
  // Sea Level param through a stylized curve, rather than being a separate
  // terrain parameter of its own. Scrubbing manually stops any Play run.
  const setYear = (year: number) => {
    const clamped = Math.min(Math.max(year, TIMELINE_MIN), TIMELINE_MAX)
    setTimelineYear(clamped)
    setT('seaLevel', seaLevelForYear(clamped))
  }

  // Play: advance the year at a fixed real-time rate until 2100, then stop.
  useEffect(() => {
    if (!timelinePlaying) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setTimelineYear((y) => {
        const next = y + dt * TIMELINE_YEARS_PER_SECOND
        if (next >= TIMELINE_MAX) {
          setTimelinePlaying(false)
          setT('seaLevel', seaLevelForYear(TIMELINE_MAX))
          return TIMELINE_MAX
        }
        setT('seaLevel', seaLevelForYear(next))
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelinePlaying])

  // terraform edits: snapshot before each stroke so Undo can step back
  const pushHistory = () =>
    setEditHistory((h) => [...h, terrain.edits].slice(-UNDO_LIMIT))
  const setEdits = (edits: TerrainEdits | null) => setT('edits', edits)
  const undoEdit = () => {
    if (editHistory.length === 0) return
    setEdits(editHistory[editHistory.length - 1])
    setEditHistory((h) => h.slice(0, -1))
  }
  const maskBrushProps = {
    enabled: painting,
    erase: maskTool === 'erase',
    radius: maskRadius,
    mask,
    params: terrain,
    // shown while painting, and while the mask is limiting where trees grow
    showOverlay: painting || (scatter.maskEnabled && isMapLike && mapTab === 'props'),
    onChange: setMask,
  }
  const brushProps = {
    enabled: sculpting,
    tool: brushTool,
    radius: brushRadius,
    strength: brushStrength,
    params: terrain,
    onStrokeStart: pushHistory,
    onChange: setEdits,
  }

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
          {isMapLike || view === '3D' ? (
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
              <TerraformBrush {...brushProps}>
                <ScatterMaskBrush {...maskBrushProps}>
                <Map
                  params={terrain}
                  forest={forest}
                  main
                  onPlaced={onPlaced}
                  onLodStats={onLodStats}
                  wireframe={wireframe}
                  snowing={isSnowing}
                  snowIntensity={weather.precipIntensity}
                  running={running}
                />
                </ScatterMaskBrush>
              </TerraformBrush>
            </>
          ) : scene === 'voxel' ? (
            <>
              <Weather params={weather} running={running} />
              <TerraformBrush {...brushProps}>
                <ScatterMaskBrush {...maskBrushProps}>
                <VoxelMap
                  params={terrain}
                  forest={forest}
                  onPlaced={onPlaced}
                  onLodStats={onLodStats}
                  wireframe={wireframe}
                />
                </ScatterMaskBrush>
              </TerraformBrush>
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
            enableRotate={isMapLike || view === '3D'}
            mouseButtons={sculpting || painting ? SCULPT_BUTTONS : ORBIT_BUTTONS}
            target={cfg.target}
            minDistance={cfg.minDistance}
            maxDistance={cfg.maxDistance}
            minZoom={cfg.minZoom}
            maxZoom={cfg.maxZoom}
            maxPolarAngle={cfg.groundLocked ? Math.PI / 2.05 : Math.PI}
          />
        </Canvas>
      </div>

      {isMapLike && showMinimap && (
        <Minimap
          params={terrain}
          mode={insetMode}
          forest={forest}
          wireframe={wireframe}
          snowing={isSnowing}
          snowIntensity={weather.precipIntensity}
          running={running}
        />
      )}

      <div className="ui-overlay">
        <header>
          <h1
            className={
              isMapLike && !showingIsland
                ? 'site-title site-title--procedural'
                : 'site-title'
            }
          >
            {headerTitle}
          </h1>
          <p className="site-subtitle">{headerSubtitle}</p>
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
              className={scene === 'voxel' ? 'active' : ''}
              onClick={() => setScene('voxel')}
              title="The same terrain and controls, rendered as blocky voxel cubes instead of a smooth mesh."
            >
              Voxel
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
            {isMapLike
              ? 'Pauses rain/snow & cloud drift. Terrain, seed and biomes still respond live — the noise stack keeps driving the height field.'
              : 'Pauses the orb’s noise animation. The sliders still reshape it while frozen.'}
          </p>

          {isMapLike && (
            <>
              <div className="panel-title">Climate Timeline</div>

              <label
                className="row"
                title="Drives Sea Level through a stylized rise curve — dragging stops Play."
              >
                <span>Year</span>
                <input
                  type="range"
                  min={TIMELINE_MIN}
                  max={TIMELINE_MAX}
                  step={1}
                  value={Math.round(timelineYear)}
                  onChange={(e) => {
                    setTimelinePlaying(false)
                    setYear(Number(e.target.value))
                  }}
                />
                <em>{Math.round(timelineYear)}</em>
              </label>

              <div className="segmented">
                <button
                  className={timelinePlaying ? 'active' : ''}
                  onClick={() => {
                    if (timelineYear >= TIMELINE_MAX) setYear(TIMELINE_MIN)
                    setTimelinePlaying(true)
                  }}
                  title="Animate forward from the current year to 2100."
                >
                  ▶ Play
                </button>
                <button
                  className={!timelinePlaying ? 'active' : ''}
                  onClick={() => setTimelinePlaying(false)}
                  title="Stop at the current year."
                >
                  ⏸ Stop
                </button>
              </div>

              <div className="panel-actions">
                <button
                  onClick={() => {
                    setTimelinePlaying(false)
                    setYear(TIMELINE_DEFAULT)
                  }}
                  title="Jump back to today and stop."
                >
                  Reset to today
                </button>
              </div>

              <p className="hint-text">
                A stylized sea-level-rise curve, not real NOAA/IPCC
                projections — illustrates how flooding reshapes the coast
                over time. Drives the Sea Level control directly.
              </p>
            </>
          )}

          {isMapLike ? (
            <>
              <div className="panel-title">View</div>
              <div className="segmented">
                <button
                  className={showMinimap ? 'active' : ''}
                  onClick={() => setShowMinimap(true)}
                  title="Show a fixed top-down inset of the island in the bottom-left corner."
                >
                  2D inset on
                </button>
                <button
                  className={!showMinimap ? 'active' : ''}
                  onClick={() => setShowMinimap(false)}
                  title="Hide the corner inset. The main view stays a free-orbiting 3D camera either way."
                >
                  2D inset off
                </button>
              </div>
              <div className="segmented">
                <button
                  className={insetMode === 'terrain' ? 'active' : ''}
                  disabled={!showMinimap}
                  onClick={() => setInsetMode('terrain')}
                  title="The inset shows the rendered island from above — biomes, water, trees."
                >
                  Inset: terrain
                </button>
                <button
                  className={insetMode === 'noise' ? 'active' : ''}
                  disabled={!showMinimap}
                  onClick={() => setInsetMode('noise')}
                  title="The inset shows the raw noise field as grayscale (black = low, white = high), after shaping but before the island mask. The red line is the coastline."
                >
                  Inset: noise
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}

          {isMapLike && (
            <>
              <div className="segmented segmented--tabs">
                <button
                  className={mapTab === 'terrain' ? 'active' : ''}
                  onClick={() => setMapTab('terrain')}
                  title="Noise stack, island outline, and mesh resolution — the shape of the land."
                >
                  Terrain
                </button>
                <button
                  className={mapTab === 'sculpt' ? 'active' : ''}
                  onClick={() => setMapTab('sculpt')}
                  title="Terraform by hand — raise, lower, and flatten the land with a brush."
                >
                  Sculpt
                </button>
                <button
                  className={mapTab === 'weather' ? 'active' : ''}
                  onClick={() => setMapTab('weather')}
                  title="Sky, sun, fog, and precipitation — the atmosphere above the land."
                >
                  Weather
                </button>
                <button
                  className={mapTab === 'props' ? 'active' : ''}
                  onClick={() => setMapTab('props')}
                  title="Trees and other objects scattered on the terrain."
                >
                  Props
                </button>
              </div>

              {mapTab === 'weather' && (
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

              <div className="panel-title">Cloud Puffs</div>

              <label
                className="row"
                title="How many individual cloud puffs are drawn. 0 hides them regardless of Cloud cover."
              >
                <span>Count</span>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={weather.cloudCount}
                  onChange={(e) => setW('cloudCount', Number(e.target.value))}
                />
                <em>{weather.cloudCount}</em>
              </label>

              <label
                className="row"
                title="Height of the cloud band above the ground, in world units."
              >
                <span>Altitude</span>
                <input
                  type="range"
                  min={8}
                  max={45}
                  step={1}
                  value={weather.cloudAltitude}
                  onChange={(e) =>
                    setW('cloudAltitude', Number(e.target.value))
                  }
                />
                <em>{weather.cloudAltitude}</em>
              </label>

              <label
                className="row"
                title="Horizontal spacing between puffs. Lower crowds them together; higher spreads them across the sky."
              >
                <span>Spread</span>
                <input
                  type="range"
                  min={4}
                  max={40}
                  step={1}
                  value={weather.cloudSpread}
                  onChange={(e) =>
                    setW('cloudSpread', Number(e.target.value))
                  }
                />
                <em>{weather.cloudSpread}</em>
              </label>

              <label
                className="row"
                title="Volume of each puff — bigger values make fluffier, larger clouds."
              >
                <span>Size</span>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={weather.cloudSize}
                  onChange={(e) => setW('cloudSize', Number(e.target.value))}
                />
                <em>{weather.cloudSize}</em>
              </label>

              <label
                className="row"
                title="Base opacity of the puffs, layered on top of the Cloud cover contribution."
              >
                <span>Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weather.cloudOpacity}
                  onChange={(e) =>
                    setW('cloudOpacity', Number(e.target.value))
                  }
                />
                <em>{weather.cloudOpacity.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="How fast each puff's turbulent surface morphs. 0 freezes their shape; still respects Pause."
              >
                <span>Speed</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weather.cloudSpeed}
                  onChange={(e) => setW('cloudSpeed', Number(e.target.value))}
                />
                <em>{weather.cloudSpeed.toFixed(2)}</em>
              </label>

              <div className="panel-actions">
                <button
                  onClick={() =>
                    setW('cloudSeed', Math.floor(Math.random() * 1000))
                  }
                  title="Reroll the puff shapes without changing count, size, or any other setting."
                >
                  Reroll clouds
                </button>
              </div>

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
                </>
              )}

              {mapTab === 'terrain' && (
                <>
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
                title="Height of the water surface. The land doesn't move — raise it to flood the coast, lower it to drain more shoreline. Biomes and tree placement shift with it."
              >
                <span>Sea Level</span>
                <input
                  type="range"
                  min={-terrain.amplitude / 2}
                  max={terrain.amplitude}
                  step={0.1}
                  value={terrain.seaLevel}
                  onChange={(e) => setT('seaLevel', Number(e.target.value))}
                />
                <em>{terrain.seaLevel.toFixed(1)}</em>
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

              <div className="panel-title">Noise Type</div>

              <label
                className="row"
                title="Mixes two noise types in every octave. 0 = pure Perlin (smooth rolling hills). 1 = pure cellular / Worley (rounded hills, one per cell, with creases between them). In between blends the two."
              >
                <span>Perlin ↔ Cell</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={terrain.noiseBlend}
                  onChange={(e) => setT('noiseBlend', Number(e.target.value))}
                />
                <em>{terrain.noiseBlend.toFixed(2)}</em>
              </label>

              <div className="panel-title">Shaping</div>

              <label
                className="row"
                title="Redistributes heights with a power curve. 1 = unchanged. Below 1 lifts the lowlands into broad uplands; above 1 flattens the valleys and leaves sharp, isolated peaks."
              >
                <span>Redistribute</span>
                <input
                  type="range"
                  min={0.3}
                  max={3}
                  step={0.05}
                  value={terrain.redistribution}
                  onChange={(e) =>
                    setT('redistribution', Number(e.target.value))
                  }
                />
                <em>{terrain.redistribution.toFixed(2)}</em>
              </label>

              <label
                className="row"
                title="Cuts the terrain into flat steps joined by short slopes, like mesas or rice terraces. 0 = off; more steps = finer terracing."
              >
                <span>Terraces</span>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={1}
                  value={terrain.terraces}
                  onChange={(e) => setT('terraces', Number(e.target.value))}
                />
                <em>{terrain.terraces === 0 ? 'off' : terrain.terraces}</em>
              </label>

              <label
                className="row"
                title="Hydraulic erosion: thousands of simulated raindrops run downhill, carving valleys and dropping sediment below them. 0 = off. Layers on top of the noise, so it follows the seed and shaping."
              >
                <span>Erosion</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={terrain.erosion}
                  onChange={(e) => setT('erosion', Number(e.target.value))}
                />
                <em>{terrain.erosion === 0 ? 'off' : `${terrain.erosion}k`}</em>
              </label>

              <div className="panel-actions">
                <button
                  onClick={() =>
                    setTerrain((t) => ({
                      ...t,
                      erosion: TERRAIN_DEFAULTS.erosion,
                      noiseBlend: TERRAIN_DEFAULTS.noiseBlend,
                      redistribution: TERRAIN_DEFAULTS.redistribution,
                      terraces: TERRAIN_DEFAULTS.terraces,
                    }))
                  }
                  title="Back to pure Perlin noise with no shaping or erosion."
                >
                  Reset shaping
                </button>
              </div>

              <p className="hint-text">
                Switch the inset to <strong>noise</strong> (View, above) to
                see these change the raw noise field directly.
              </p>

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
                </>
              )}

              {mapTab === 'sculpt' && (
                <>
              <div className="panel-title">Terraform</div>

              <div className="segmented">
                {BRUSH_TOOLS.map(({ tool, label, hint }) => (
                  <button
                    key={tool}
                    className={brushTool === tool ? 'active' : ''}
                    onClick={() => setBrushTool(tool)}
                    title={hint}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label
                className="row"
                title="Brush radius, in world units. The island is about 100 units long."
              >
                <span>Size</span>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={0.5}
                  value={brushRadius}
                  onChange={(e) => setBrushRadius(Number(e.target.value))}
                />
                <em>{brushRadius.toFixed(1)}</em>
              </label>

              <label
                className="row"
                title="How fast the brush works. For Raise/Lower it's height per second at the brush centre. For Flatten it's how quickly the land eases to the target height."
              >
                <span>Strength</span>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={brushStrength}
                  onChange={(e) => setBrushStrength(Number(e.target.value))}
                />
                <em>{brushStrength.toFixed(1)}</em>
              </label>

              <div className="panel-actions">
                <button
                  disabled={editHistory.length === 0}
                  onClick={undoEdit}
                  title="Step back one brush stroke (or one reset)."
                >
                  Undo
                </button>
                <button
                  disabled={!terrain.edits}
                  onClick={() => {
                    pushHistory()
                    setEdits(null)
                  }}
                  title="Remove every hand edit and go back to the pure procedural terrain. Undo brings them back."
                >
                  Reset edits
                </button>
              </div>

              <p className="hint-text">
                While this tab is open, <strong>left-drag</strong> on the
                land or water to sculpt. <strong>Right-drag</strong> orbits
                and the wheel zooms. Edits sit on top of the noise, so they
                survive seed, shaping, and sea-level changes, and biomes,
                trees, and voxels follow them.
              </p>
                </>
              )}

              {mapTab === 'props' && <TreePanel c={trees} painting={painting} />}

              {mapTab === 'terrain' && (
                <>
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
            {isMapLike ? (
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
