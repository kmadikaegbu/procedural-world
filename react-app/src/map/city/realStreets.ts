/**
 * THE REAL STREETS: the centre line of every street, highway, path and alley on
 * the map, from the city's Centerline data (CSCL), with the width of each
 * roadbed and the year the oldest buildings near it went up.
 * scripts/build-nyc-streets.mjs makes the file (public/data/nyc-streets.bin);
 * this reads it. layout.ts lays the streets along these lines, and lines up
 * the lost city's buildings along them.
 */

/** What a line is, as the file stores it. */
export const StreetKind = { Street: 0, Highway: 1, Path: 2, Ramp: 3, Alley: 4 } as const
export type StreetKind = (typeof StreetKind)[keyof typeof StreetKind]

export interface RealStreets {
  count: number
  kind: Uint8Array
  /** Roadbed width, metres (0 = not recorded). */
  width: Float32Array
  /** The year the oldest buildings standing near it went up (0 = none near). */
  year: Uint16Array
  /** Line i's vertices are start[i] … start[i + 1] - 1 in x and z. */
  start: Uint32Array
  /** Vertices, world units. */
  x: Float32Array
  z: Float32Array
}

const FILE = `${import.meta.env.BASE_URL}data/nyc-streets.bin`

let loading: Promise<RealStreets> | null = null

/** Fetch and unpack the file, once per page. */
export function loadRealStreets(): Promise<RealStreets> {
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

function unpack(buf: ArrayBuffer): RealStreets {
  const head = new DataView(buf, 0, 16)
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))
  if (magic !== 'NYCS' || head.getUint32(4, true) !== 1) throw new Error(`${FILE} is not a streets file`)
  const n = head.getUint32(8, true)
  const nv = head.getUint32(12, true)
  // the columns, in the order the script writes them (see its header comment)
  const dv = new DataView(buf)
  let off = 16
  const kind = new Uint8Array(buf.slice(off, off + n))
  off += n
  const halfMetres = new Uint8Array(buf, off, n)
  off += n
  const year = new Uint16Array(n)
  for (let i = 0; i < n; i++) year[i] = dv.getUint16(off + i * 2, true)
  off += n * 2
  const start = new Uint32Array(n + 1)
  for (let i = 0; i < n; i++) start[i + 1] = start[i] + dv.getUint16(off + i * 2, true)
  off += n * 2
  const x = new Float32Array(nv)
  const z = new Float32Array(nv)
  for (let i = 0; i < nv; i++) {
    x[i] = dv.getInt16(off + i * 4, true) / 64
    z[i] = dv.getInt16(off + i * 4 + 2, true) / 64
  }
  const width = Float32Array.from(halfMetres, (h) => h / 2)
  return { count: n, kind, width, year, start, x, z }
}
