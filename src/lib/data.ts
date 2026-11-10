import type { CityId } from '../config/cities'

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
