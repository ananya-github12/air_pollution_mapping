/**
 * India's National Air Quality Index (NAQI, CPCB). The AQI is the highest of the
 * pollutant sub-indices; here we use the two that matter most: PM2.5 and PM10 (24-h means, µg/m³).
 */

type Breakpoints = [concLo: number, concHi: number, aqiLo: number, aqiHi: number][]

const PM25: Breakpoints = [
  [0, 30, 0, 50],
  [30, 60, 50, 100],
  [60, 90, 100, 200],
  [90, 120, 200, 300],
  [120, 250, 300, 400],
  [250, 500, 400, 500],
]

const PM10: Breakpoints = [
  [0, 50, 0, 50],
  [50, 100, 50, 100],
  [100, 250, 100, 200],
  [250, 350, 200, 300],
  [350, 430, 300, 400],
  [430, 860, 400, 500],
]

function subIndex(conc: number, table: Breakpoints): number {
  for (const [cLo, cHi, aLo, aHi] of table) {
    if (conc <= cHi) return aLo + ((conc - cLo) * (aHi - aLo)) / (cHi - cLo)
  }
  return 500
}

export function naqi(pm25: number, pm10: number): number {
  return Math.round(Math.min(500, Math.max(subIndex(pm25, PM25), subIndex(pm10, PM10))))
}

export interface AqiCategory {
  label: string
  color: string // soft tint, informative rather than alarming
  tip: string
}

export function aqiCategory(aqi: number): AqiCategory {
  if (aqi <= 50) return { label: 'Good', color: '#86efac', tip: 'A lovely day to be outside.' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#bef264', tip: 'Fine for most people to be outdoors.' }
  if (aqi <= 200) return { label: 'Moderate', color: '#fde047', tip: 'Sensitive folks may want to go easy outdoors.' }
  if (aqi <= 300) return { label: 'Poor', color: '#fdba74', tip: 'A good day to keep long outdoor workouts short.' }
  if (aqi <= 400) return { label: 'Very poor', color: '#fca5a5', tip: 'Indoor workouts make more sense today.' }
  return { label: 'Severe', color: '#f9a8d4', tip: 'Best to keep time outdoors short today.' }
}

/** WHO 2021 24-hour guideline for PM2.5, µg/m³. */
export const WHO_PM25_DAILY = 15

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Start hour of the `width`-hour window with the lowest (or highest) mean. */
export function extremeWindow(hourly: number[], width: number, kind: 'min' | 'max'): number {
  let bestStart = 0
  let bestVal = kind === 'min' ? Infinity : -Infinity
  for (let start = 0; start + width <= hourly.length; start++) {
    const v = mean(hourly.slice(start, start + width))
    if (kind === 'min' ? v < bestVal : v > bestVal) {
      bestVal = v
      bestStart = start
    }
  }
  return bestStart
}

function hourLabel(h: number): { n: number; ap: string } {
  const hh = ((h % 24) + 24) % 24
  return { n: hh % 12 === 0 ? 12 : hh % 12, ap: hh < 12 ? 'am' : 'pm' }
}

/** e.g. formatHourRange(14, 3) → "2–5 pm", formatHourRange(10, 3) → "10 am–1 pm" */
export function formatHourRange(start: number, width: number): string {
  const a = hourLabel(start)
  const b = hourLabel(start + width)
  return a.ap === b.ap ? `${a.n}–${b.n} ${b.ap}` : `${a.n} ${a.ap}–${b.n} ${b.ap}`
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']

/** Meteorological bearing (where the wind comes FROM) → "north-west". */
export function compass(bearing: number): string {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]
}
