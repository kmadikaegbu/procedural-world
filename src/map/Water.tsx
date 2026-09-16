import { MAP_SIZE } from './Terrain'

export function Water({ level = 0 }: { level?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
      <meshStandardMaterial
        color="#5a86a0"
        transparent
        opacity={0.72}
        roughness={0.15}
        metalness={0.2}
      />
    </mesh>
  )
}
