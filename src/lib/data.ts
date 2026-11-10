import type { CityId } from '../config/cities'
import { gridFromRaw, type RawWindGrid, type WindGrid } from './trajectory.ts'
import type { Fire } from './stats.ts'

/**
 * Where the app reads its data from. Phase 1 uses hand-crafted samples in public/data/mock/;
 * Phase 2 will add snapshots in public/data/live/. Set VITE_DATA_MODE=live to switch.
 */
export type DataMode = 'mock' | 'live'

export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'mock'

export const DATA_BASE = `/data/${DATA_MODE}`

export type SourceId = 'crop-fires' | 'vehicles' | 'dust' | 'industry' | 'firecrackers' | 'household' | 'other'

export interface SourceShare {
  id: SourceId
  label: string
  share: number // estimated % of the city's PM2.5 today
}

interface SourcesFile {
  pollutant: string
  updatedAt: string
  cities: Record<CityId, SourceShare[]>
}

let sourcesPromise: Promise<SourcesFile> | undefined

/** Estimated city-wide source shares. Fetched once and cached. */
export async function loadSources(city: CityId): Promise<SourceShare[]> {
  sourcesPromise ??= fetch(`${DATA_BASE}/sources.json`).then((r) => {
    if (!r.ok) throw new Error(`sources.json: ${r.status}`)
    return r.json()
  })
  const file = await sourcesPromise
  // Biggest first, but "Everything else" always last.
  return [...file.cities[city]].sort((a, b) => (a.id === 'other' ? 1 : b.id === 'other' ? -1 : b.share - a.share))
}

export interface AirToday {
  pm25: number[] // hourly, µg/m³, hours 0–23 local time
  pm10: number[]
  windKmh: number
  windFrom: number // meteorological bearing, degrees
}

interface AirTodayFile {
  date: string
  cities: Record<CityId, AirToday>
}

let airTodayPromise: Promise<AirTodayFile> | undefined

/** Today's hourly air for a city. Fetched once and cached. */
export async function loadAirToday(city: CityId): Promise<AirToday> {
  airTodayPromise ??= fetch(`${DATA_BASE}/airtoday.json`).then((r) => {
    if (!r.ok) throw new Error(`airtoday.json: ${r.status}`)
    return r.json()
  })
  return (await airTodayPromise).cities[city]
}

export interface SourceHistory {
  daily: { start: string; values: Record<SourceId, number[]> } // one value per day, oldest first
  hourly: { start: string; values: Record<SourceId, number[]> } // one value per hour, oldest first
}

let historyPromise: Promise<{ cities: Record<CityId, SourceHistory> }> | undefined

/** Estimated contribution to PM2.5 (µg/m³) by source over time. Fetched once and cached. */
export async function loadHistory(city: CityId): Promise<SourceHistory> {
  historyPromise ??= fetch(`${DATA_BASE}/history.json`).then((r) => {
    if (!r.ok) throw new Error(`history.json: ${r.status}`)
    return r.json()
  })
  return (await historyPromise).cities[city]
}

// ---- Trace inputs: wind grid + fire hotspots ------------------------------------------------

export interface TraceData {
  grid: WindGrid
  fires: Fire[]
}

interface FireRow {
  lat: number
  lon: number
  detectedAt: string
  confidence: string
}

let traceDataPromise: Promise<TraceData> | undefined

/** Wind grid and fire detections for the last 48 h. Fetched once and cached; retried after a failure. */
export function loadTraceData(): Promise<TraceData> {
  traceDataPromise ??= Promise.all([
    fetch(`${DATA_BASE}/wind.json`).then((r) => (r.ok ? (r.json() as Promise<RawWindGrid>) : Promise.reject(new Error(`wind.json: ${r.status}`)))),
    fetch(`${DATA_BASE}/fires.json`).then((r) => (r.ok ? (r.json() as Promise<FireRow[]>) : Promise.reject(new Error(`fires.json: ${r.status}`)))),
  ])
    .then(([wind, fires]) => ({
      grid: gridFromRaw(wind),
      fires: fires.map((f) => ({ lat: f.lat, lon: f.lon, t: Date.parse(f.detectedAt), confidence: f.confidence })),
    }))
    .catch((err) => {
      traceDataPromise = undefined
      throw err
    })
  return traceDataPromise
}
