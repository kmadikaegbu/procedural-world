// Drives the island's climate timeline: a year maps to a sea level, which
// feeds straight into the existing TerrainParams.seaLevel — flooding the
// coast exactly the way the manual Sea Level slider already does. No new
// terrain mechanic, just a time-indexed way to set the one that exists.

export const TIMELINE_MIN = 1950
export const TIMELINE_MAX = 2100
export const TIMELINE_DEFAULT = 2026 // "today"

// how much the sea level moves per real second while Play is running
export const TIMELINE_YEARS_PER_SECOND = 8

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Year → sea level. This is a STYLIZED, illustrative curve for dramatizing
 * coastal flooding over time — it is not sourced from NOAA/IPCC projections
 * or any real tide-gauge data, and shouldn't be read as a scientific
 * forecast. Shaped to accelerate toward 2100 (slow historically, faster
 * going forward), which is the qualitative shape commonly cited for
 * sea-level-rise projections, without claiming real figures.
 */
export function seaLevelForYear(year: number): number {
  const t = clamp01((year - TIMELINE_MIN) / (TIMELINE_MAX - TIMELINE_MIN))
  const eased = t * t // ease-in: slow start, accelerating rise
  return -1 + eased * 3.4 // -1 at 1950 (more exposed coast) .. +2.4 at 2100
}
