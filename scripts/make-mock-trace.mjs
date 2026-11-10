// Generates SAMPLE wind + fire data for the trace (Phase 1). Deterministic (seeded).
//   node scripts/make-mock-trace.mjs
// wind.json : hourly wind at ~100 m on a 1° grid over north India for the last 48 h.
//             Delhi's air arrives from the north-west, Lucknow's from the west/north-west.
// fires.json: a few hundred hotspots across Punjab, Haryana and western/central UP,
//             timed to the satellite passes (~1:30 pm and ~1:30 am IST).
import { writeFileSync } from 'node:fs'

const DIR = new URL('../public/data/mock/', import.meta.url)
const END = Date.parse('2026-11-10T00:00:00Z') // 5:30 am IST, 10 Nov 2026
const HOURS = 49 // hour 0 … hour 48 (= END)
const BBOX = { west: 72, south: 23, east: 85, north: 33, step: 1 }

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Wind -------------------------------------------------------------------------------
const rand = rng(7)
const nx = Math.round((BBOX.east - BBOX.west) / BBOX.step) + 1
const ny = Math.round((BBOX.north - BBOX.south) / BBOX.step) + 1
const speed = []
const dir = []
for (let h = 0; h < HOURS; h++) {
  const hourIST = (new Date(END - (HOURS - 1 - h) * 3600e3).getUTCHours() + 5.5) % 24
  for (let j = 0; j < ny; j++) {
    const lat = BBOX.south + j * BBOX.step
    for (let i = 0; i < nx; i++) {
      const lon = BBOX.west + i * BBOX.step
      // North-westerlies over Punjab/Delhi, veering to west-north-westerly over central UP.
      const d = 312 - (lon - 76) * 4 + 12 * Math.sin((2 * Math.PI * h) / 30 + lat / 3) + (rand() - 0.5) * 6
      // Light winds, a bit stronger in the afternoon when the air mixes.
      const s = 2.3 + 0.9 * Math.exp(-((hourIST - 14) ** 2) / 18) + (lat - 26) * 0.05 + (rand() - 0.5) * 0.4
      speed.push(Math.round(Math.max(0.5, s) * 10) / 10)
      dir.push(Math.round((d + 360) % 360))
    }
  }
}
const wind = {
  note: 'SAMPLE data: hourly wind at ~100 m, 1° grid. speed m/s; dir = where the wind blows FROM (degrees). Layout [hour][row][col].',
  west: BBOX.west,
  south: BBOX.south,
  step: BBOX.step,
  nx,
  ny,
  start: new Date(END - (HOURS - 1) * 3600e3).toISOString(),
  hours: HOURS,
  speed,
  dir,
}
writeFileSync(new URL('wind.json', DIR), JSON.stringify(wind))

// ---- Fires ------------------------------------------------------------------------------
const frand = rng(42)
const gaussian = () => {
  const u = 1 - frand()
  const v = frand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
// [name, lat, lon, spreadLat, spreadLon, count]
const CLUSTERS = [
  ['Punjab (Malwa)', 30.4, 75.0, 0.45, 0.75, 230],
  ['Punjab (Majha/Doaba)', 31.3, 75.2, 0.35, 0.5, 110],
  ['Punjab (Pakistan)', 31.0, 73.7, 0.4, 0.5, 45],
  ['Haryana (north)', 29.9, 76.6, 0.35, 0.45, 95],
  ['Haryana (west)', 29.3, 75.9, 0.35, 0.45, 80],
  ['Western UP', 28.6, 78.3, 0.45, 0.7, 90],
  ['Western UP (south)', 27.7, 78.4, 0.35, 0.5, 55],
  ['Central UP', 27.5, 79.8, 0.4, 0.6, 60],
  ['Central UP (east)', 26.9, 80.6, 0.35, 0.4, 35],
]
// Satellite passes in the 48-h window (UTC): ~08:00 (1:30 pm IST, most fires) and ~20:00 (1:30 am IST).
const PASSES = [
  [Date.parse('2026-11-08T08:00:00Z'), 0.38],
  [Date.parse('2026-11-08T20:00:00Z'), 0.12],
  [Date.parse('2026-11-09T08:00:00Z'), 0.38],
  [Date.parse('2026-11-09T20:00:00Z'), 0.12],
]
const pickPass = () => {
  let r = frand()
  for (const [t, w] of PASSES) {
    if ((r -= w) <= 0) return t
  }
  return PASSES[0][0]
}
const fires = []
for (const [, lat, lon, sLat, sLon, count] of CLUSTERS) {
  for (let k = 0; k < count; k++) {
    const t = pickPass() + Math.round((frand() - 0.5) * 50) * 60e3
    const c = frand()
    fires.push({
      lat: Math.round((lat + gaussian() * sLat) * 1e4) / 1e4,
      lon: Math.round((lon + gaussian() * sLon) * 1e4) / 1e4,
      detectedAt: new Date(t).toISOString().replace('.000', ''),
      confidence: c < 0.15 ? 'l' : c < 0.8 ? 'n' : 'h',
    })
  }
}
writeFileSync(new URL('fires.json', DIR), JSON.stringify(fires))
console.log(`wind: ${nx}×${ny}×${HOURS}  fires: ${fires.length}`)
