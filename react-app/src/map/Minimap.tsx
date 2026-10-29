import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Map } from './Map'
import { NoisePlane } from './NoisePlane'
import type { TerrainParams } from './noise'
import type { Forest } from './trees/forest'
import type { WaterSettings } from './water/settings'
import type { GrassSettings } from './grass/settings'
import type { WeatherParams } from '../weather/presets'
import { WORLD } from './world/shore'

// the whole city fits the box when 1 box pixel = this many world units
const BOX_PX = 200
const CENTRE_X = (WORLD.x0 + WORLD.x1) / 2
const CENTRE_Z = (WORLD.z0 + WORLD.z1) / 2
const FIT_ZOOM = BOX_PX / (1.04 * Math.max(WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0))

export type InsetMode = 'terrain' | 'noise'

/**
 * Fixed top-down inset of the WHOLE city, pinned to the corner of the screen.
 * A second <Canvas> (its own GL context) rather than a multi-viewport trick —
 * simplest to reason about, at the cost of regenerating the terrain/props
 * a second time — so it builds a much lighter mesh and leaves out the trees,
 * which are far too small to see at this size.
 *
 * `mode="noise"` swaps the rendered map for a flat grayscale image of the
 * noise field itself — the 2D view of the noise equation.
 */
export function Minimap({
  params,
  mode = 'terrain',
  wireframe,
  forest,
  water,
  grass,
  weather,
  snowing = false,
  snowIntensity = 1,
  running = true,
}: {
  params: TerrainParams
  mode?: InsetMode
  wireframe: boolean
  forest: Forest
  water: WaterSettings
  grass: GrassSettings
  weather: WeatherParams
  snowing?: boolean
  snowIntensity?: number
  running?: boolean
}) {
  // the same forest settings, but hidden: ~30,000 trees mean nothing in a 200-px inset
  const insetForest = useMemo(() => ({ ...forest, show: false }), [forest])
  return (
    <div className="minimap">
      <span className="minimap-label">{mode === 'noise' ? 'Noise' : '2D'}</span>
      <Canvas>
        <color attach="background" args={['#0f0f17']} />
        {/* flat, weather-independent lighting — a minimap should stay
            legible no matter what the main scene's sky is doing */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 20, 5]} intensity={1.2} />

        {/* zoom is tuned for this box's pixel size, not the main viewport's —
            visible world width ≈ box px / zoom, here chosen so the whole city fits.
            No OrbitControls here to aim the camera (unlike the main canvas),
            so it needs an explicit rotation — straight down, -90° about X —
            instead of relying on lookAt. */}
        <OrthographicCamera
          makeDefault
          position={[CENTRE_X, 400, CENTRE_Z]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={FIT_ZOOM}
          near={0.1}
          far={1000}
        />

        {mode === 'noise' ? (
          <NoisePlane params={params} />
        ) : (
          <Map
            params={params}
            wireframe={wireframe}
            forest={insetForest}
            quality="low"
            water={water}
            grass={grass}
            weather={weather}
            snowing={snowing}
            snowIntensity={snowIntensity}
            running={running}
          />
        )}
      </Canvas>
    </div>
  )
}
