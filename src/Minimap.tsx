import { Canvas } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Map } from './map/Map'
import type { TerrainParams } from './map/noise'

/**
 * Fixed top-down inset of the map, pinned to the corner of the screen.
 * A second <Canvas> (its own GL context) rather than a multi-viewport trick —
 * simplest to reason about, at the cost of regenerating the terrain/props
 * a second time. Fine at this scene's scale; revisit if resolution/tree count
 * grow much further.
 */
export function Minimap({
  params,
  wireframe,
  showTrees,
  treeCount,
  scatterSeed,
  snowing = false,
  snowIntensity = 1,
  running = true,
}: {
  params: TerrainParams
  wireframe: boolean
  showTrees: boolean
  treeCount: number
  scatterSeed: number
  snowing?: boolean
  snowIntensity?: number
  running?: boolean
}) {
  return (
    <div className="minimap">
      <span className="minimap-label">2D</span>
      <Canvas>
        <color attach="background" args={['#0f0f17']} />
        {/* flat, weather-independent lighting — a minimap should stay
            legible no matter what the main scene's sky is doing */}
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 20, 5]} intensity={1.2} />

        {/* zoom is tuned for this box's pixel size, not the main viewport's —
            visible world width ≈ box px / zoom, want ~115 units to frame the
            ~100-unit island with a small margin.
            No OrbitControls here to aim the camera (unlike the main canvas),
            so it needs an explicit rotation — straight down, -90° about X —
            instead of relying on lookAt. */}
        <OrthographicCamera
          makeDefault
          position={[0, 90, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          zoom={1.75}
          near={0.1}
          far={400}
        />

        <Map
          params={params}
          wireframe={wireframe}
          showTrees={showTrees}
          treeCount={treeCount}
          scatterSeed={scatterSeed}
          snowing={snowing}
          snowIntensity={snowIntensity}
          running={running}
        />
      </Canvas>
    </div>
  )
}
