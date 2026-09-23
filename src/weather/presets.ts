// Weather is a parameter object, like the map. One `WeatherParams` drives the
// sky, sun, fog, clouds, and precipitation together so a preset (or a slider)
// changes the whole atmosphere at once.

export type Precip = 'none' | 'rain' | 'snow'

export type WeatherParams = {
  sunElevation: number // 0 = horizon (sunset), 1 = noon, <0 = night
  sunAzimuth: number // compass direction of the sun, radians
  cloudCover: number // 0 = clear, 1 = overcast — dims the sun & darkens/thickens puffs
  fogDensity: number // 0 = none, 1 = pea soup
  precip: Precip
  precipIntensity: number // 0..1 → particle count + opacity
  wind: number // horizontal drift, world units/sec

  // individual cloud-puff controls, independent of cloudCover's overall dimming
  cloudCount: number // how many puffs — 0 hides them outright
  cloudAltitude: number // height of the cloud band, world units
  cloudSpread: number // horizontal spacing between puffs
  cloudSize: number // volume per puff — bigger = fluffier/larger
  cloudOpacity: number // base opacity, layered with cloudCover
  cloudSpeed: number // turbulence/morph animation speed
  cloudSeed: number // reroll puff shapes without touching anything else
}

export const WEATHER_DEFAULTS: WeatherParams = {
  sunElevation: 0.35,
  sunAzimuth: 2.4,
  cloudCover: 0.25,
  fogDensity: 0.12,
  precip: 'none',
  precipIntensity: 0.5,
  wind: 1.5,

  cloudCount: 4,
  cloudAltitude: 24,
  cloudSpread: 18,
  cloudSize: 10,
  cloudOpacity: 0.35,
  cloudSpeed: 0.2,
  cloudSeed: 0,
}

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog'

export const WEATHER_PRESETS: Record<WeatherKind, WeatherParams> = {
  clear: { ...WEATHER_DEFAULTS, cloudCover: 0.1, fogDensity: 0.05 },
  cloudy: {
    ...WEATHER_DEFAULTS,
    cloudCover: 0.6,
    fogDensity: 0.15,
    cloudCount: 6,
  },
  rain: {
    ...WEATHER_DEFAULTS,
    sunElevation: 0.18,
    cloudCover: 0.85,
    fogDensity: 0.3,
    precip: 'rain',
    precipIntensity: 0.6,
    wind: 3,
    cloudCount: 7,
    cloudSize: 13,
    cloudSpeed: 0.3,
  },
  snow: {
    ...WEATHER_DEFAULTS,
    sunElevation: 0.22,
    cloudCover: 0.75,
    fogDensity: 0.35,
    precip: 'snow',
    precipIntensity: 0.5,
    wind: 1,
    cloudCount: 6,
    cloudAltitude: 20,
  },
  storm: {
    ...WEATHER_DEFAULTS,
    sunElevation: 0.1,
    cloudCover: 1,
    fogDensity: 0.45,
    precip: 'rain',
    precipIntensity: 1,
    wind: 6,
    cloudCount: 9,
    cloudSize: 16,
    cloudSpeed: 0.45,
  },
  fog: {
    ...WEATHER_DEFAULTS,
    sunElevation: 0.25,
    cloudCover: 0.4,
    fogDensity: 0.8,
    precip: 'none',
    cloudCount: 3,
    cloudAltitude: 14,
  },
}

// warm-leaning sky/fog tint that darkens as the sun drops (matches STYLE-GUIDE)
export function skyTint(sunElevation: number): string {
  if (sunElevation <= 0) return '#0b0b16' // night
  if (sunElevation < 0.2) return '#3a2b33' // dusk
  if (sunElevation < 0.45) return '#6b5563' // golden hour
  return '#8fa3b0' // midday
}
