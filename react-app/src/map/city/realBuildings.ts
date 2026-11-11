/**
 * THE REAL BUILDINGS: every building that stands on the map today, from the
 * city's Building Footprints data, with the year it went up and its roof height.
 * scripts/build-nyc-buildings.mjs makes the file (public/data/nyc-buildings.bin);
 * this reads it. layout.ts turns each one into a lot.
 *
 * Each building is the smallest rectangle around its real outline, so it can be
 * drawn as a box like every other building in the app.
 */

export interface RealBuildings {
  count: number
  /** Centre, world units. */
  x: Float32Array
  z: Float32Array
  /** The rectangle's sides, world units; `angle` is the w side's direction from east (radians). */
  w: Float32Array
  d: Float32Array
  angle: Float32Array
  /** Roof height above the ground, metres (0 = not measured). */
  height: Float32Array
  /** Construction year (0 = not recorded). */
  year: Uint16Array
}

const FILE = `${import.meta.env.BASE_URL}data/nyc-buildings.bin`

let loading: Promise<RealBuildings> | null = null

/** Fetch and unpack the file, once per page. */
export function loadRealBuildings(): Promise<RealBuildings> {
  if (!loading) {
    loading = fetch(FILE)
      .then((res) => {
        if (!res.ok) throw new Error(`${FILE}: HTTP ${res.status}`)
        return res.arrayBuffer()
      })
      .then(unpack)
    loading.catch(() => (loading = null)) // a failed load can be tried again
  }
  return loading
}

function unpack(buf: ArrayBuffer): RealBuildings {
  const head = new DataView(buf, 0, 16)
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))
  if (magic !== 'NYCB' || head.getUint32(4, true) !== 1) throw new Error(`${FILE} is not a buildings file`)
  const n = head.getUint32(8, true)
  // the columns, in the order the script writes them (see its header comment)
  let off = 16
  const take16 = <T extends Int16Array | Uint16Array>(Kind: new (b: ArrayBuffer, o: number, l: number) => T): T => {
    const a = new Kind(buf, off, n)
    off += n * 2
    return a
  }
  const x = take16(Int16Array)
  const z = take16(Int16Array)
  const w = take16(Uint16Array)
  const d = take16(Uint16Array)
  const h = take16(Uint16Array)
  const year = take16(Uint16Array)
  const rot = new Uint8Array(buf, off, n)

  const out: RealBuildings = {
    count: n,
    x: new Float32Array(n),
    z: new Float32Array(n),
    w: new Float32Array(n),
    d: new Float32Array(n),
    angle: new Float32Array(n),
    height: new Float32Array(n),
    year: Uint16Array.from(year),
  }
  for (let i = 0; i < n; i++) {
    out.x[i] = x[i] / 64
    out.z[i] = z[i] / 64
    out.w[i] = w[i] / 256
    out.d[i] = d[i] / 256
    out.angle[i] = (rot[i] / 256) * Math.PI
    out.height[i] = h[i] / 10
  }
  return out
}
