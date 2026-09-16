import { Sky } from './Sky'
import { Clouds } from './Clouds'
import { Precipitation } from './Precipitation'
import {
  WEATHER_DEFAULTS,
  WEATHER_PRESETS,
  type WeatherParams,
  type WeatherKind,
} from './presets'

export { WEATHER_DEFAULTS, WEATHER_PRESETS }
export type { WeatherParams, WeatherKind }

/**
 * Drop-in atmosphere. `params` drives sky colour, sun position & intensity,
 * fog, cloud cover, and precipitation together.
 *
 *   const [weather, setWeather] = useState(WEATHER_PRESETS.rain)
 *   <Canvas shadows><Weather params={weather} /> ...</Canvas>
 *
 * Needs `shadows` on <Canvas> for the sun shadow. `running=false` freezes the
 * precipitation and cloud drift in place (the "stop simulation" control).
 */
export function Weather({
  params = WEATHER_DEFAULTS,
  running = true,
}: {
  params?: WeatherParams
  running?: boolean
}) {
  return (
    <>
      <Sky params={params} />
      <Clouds params={params} running={running} />
      <Precipitation
        kind={params.precip}
        intensity={params.precipIntensity}
        wind={params.wind}
        running={running}
      />
    </>
  )
}
