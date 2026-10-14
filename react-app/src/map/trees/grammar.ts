/**
 * GRAMMAR — the rewriting half of the L-system (no geometry here).
 *
 *   parseRules()  turns the readable rule text in species.ts into a lookup table
 *   expand()      applies those rules to the axiom, generation after generation
 *
 * Every symbol carries two extra facts besides its letter:
 *   id    a number unique to that symbol, made from its parent's id and its
 *         position in the replacement — so it is the same every time you grow
 *         the same tree, no matter what else is in the string
 *   born  which generation created it
 *
 * The turtle uses `id` for all of its randomness, and the LOD builder uses
 * `born` to cut a tree back by one generation (see turtle.ts → generateTreeStages).
 */

// ---------------------------------------------------------------------------
// STEP 1 — rewrite the axiom, `iterations` times
// ---------------------------------------------------------------------------

type Alternatives = { weight: number; to: string }[]

export function parseRules(text: string): Map<string, Alternatives> {
  const table = new Map<string, Alternatives>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim()
    if (!line) continue
    const m = /^(\S)\s*->\s*(?:(\d*\.?\d+)\s*:\s*)?(\S+)$/.exec(line)
    if (!m) throw new Error(`Bad L-system rule: "${raw.trim()}"`)
    const list = table.get(m[1]) ?? []
    list.push({ weight: m[2] ? parseFloat(m[2]) : 1, to: m[3] })
    table.set(m[1], list)
  }
  return table
}

/** Mix two 32-bit ints into a well-scrambled third. */
export function hash32(a: number, b: number): number {
  let h = (a ^ Math.imul(b + 0x7f4a7c15, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
/** hash32 as a 0..1 float. */
export const hash01 = (a: number, b: number) => hash32(a, b) / 4294967296

/** One symbol of the expanded string, plus where it came from. */
export interface Sym {
  ch: string
  /** Stable identity: a hash of its parent's id and its slot in the replacement. */
  id: number
  /** Generation that produced it (0 = the axiom). */
  born: number
}

/** Safety valve: a rule set that fans out too fast stops growing here. */
const MAX_SYMBOLS = 8000

export function expand(
  axiom: string,
  rules: Map<string, Alternatives>,
  iterations: number,
  rng: () => number,
  seed: number,
): { symbols: Sym[]; generations: number } {
  let cur: Sym[] = [...axiom].map((ch, i) => ({
    ch,
    id: hash32(seed, i + 1),
    born: 0,
  }))
  let generations = 0
  for (let g = 1; g <= iterations; g++) {
    const next: Sym[] = []
    for (const sym of cur) {
      const alts = rules.get(sym.ch)
      if (!alts) {
        next.push(sym) // untouched: keeps its id and birth generation
        continue
      }
      // weighted pick — one rng() per rewritten symbol, in string order
      let total = 0
      for (const a of alts) total += a.weight
      let roll = rng() * total
      let pick = alts[alts.length - 1]
      for (const a of alts) {
        roll -= a.weight
        if (roll < 0) {
          pick = a
          break
        }
      }
      let slot = 0
      for (const ch of pick.to) {
        next.push({ ch, id: hash32(sym.id, ++slot), born: g })
      }
    }
    if (next.length > MAX_SYMBOLS) break
    cur = next
    generations = g
  }
  return { symbols: cur, generations }
}
