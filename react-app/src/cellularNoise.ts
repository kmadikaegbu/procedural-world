// Minimal 3D cellular (Worley / Voronoi) noise for CPU vertex displacement.
// Returns the distance to the nearest feature point (f1) and second-nearest (f2).

const frac = (n: number) => n - Math.floor(n)

// one pseudo-random feature-point offset per integer cell, in [0,1)^3
function cellPoint(i: number, j: number, k: number, seed: number): [number, number, number] {
  const s = seed * 17.13
  return [
    frac(Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + s) * 43758.5453),
    frac(Math.sin(i * 269.5 + j * 183.3 + k * 246.1 + s) * 43758.5453),
    frac(Math.sin(i * 113.5 + j * 271.9 + k * 124.6 + s) * 43758.5453),
  ]
}

export type Cellular = { f1: number; f2: number }

/**
 * @param jitter 0 = feature points locked to cell centres (regular grid),
 *               1 = fully scattered within their cell
 */
export function cellular3(
  x: number,
  y: number,
  z: number,
  jitter: number,
  seed: number,
): Cellular {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi

  let f1 = Infinity
  let f2 = Infinity

  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      for (let dk = -1; dk <= 1; dk++) {
        const p = cellPoint(xi + di, yi + dj, zi + dk, seed)
        const fx = di + (0.5 + jitter * (p[0] - 0.5)) - xf
        const fy = dj + (0.5 + jitter * (p[1] - 0.5)) - yf
        const fz = dk + (0.5 + jitter * (p[2] - 0.5)) - zf
        const d = Math.sqrt(fx * fx + fy * fy + fz * fz)
        if (d < f1) {
          f2 = f1
          f1 = d
        } else if (d < f2) {
          f2 = d
        }
      }
    }
  }

  return { f1, f2 }
}
