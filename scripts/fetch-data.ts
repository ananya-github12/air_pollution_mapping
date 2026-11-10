// Fetches LIVE data snapshots into public/data/live/. Run on your machine:
//   npm run fetch-data                     (everything that has a key in .env)
//   npm run fetch-data -- --only=wind,air  (just some parts)
//
// Sources (docs checked Nov 2026):
//   wind  – Open-Meteo Forecast API, wind at 120 m, 0.5° grid, last 48 h        (no key)
//   air   – CPCB stations via OpenAQ v3 (needs OPENAQ_API_KEY); falls back to the
//           Open-Meteo Air Quality API (CAMS model) when no key / too few stations
//   fires – NASA FIRMS area API, VIIRS NRT (S-NPP, NOAA-20, NOAA-21)           (needs FIRMS_MAP_KEY)
// Source-share and trend files have no real source yet: they're copied from mock and flagged sample.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CITIES, type CityId } from '../src/config/cities.ts'

const OUT = new URL('../public/data/live/', import.meta.url)
const MOCK = new URL('../public/data/mock/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',')
const want = (part: string) => !only || only.includes(part)

const BBOX = { west: 72, south: 23, east: 85, north: 33, step: 0.5 } // north India
const HOURS = 49 // now and the 48 hours before
const H = 3600e3
const NOW_HOUR = Math.floor(Date.now() / H) * H // latest whole hour, UTC
const START = NOW_HOUR - (HOURS - 1) * H
const isoHour = (t: number) => new Date(t).toISOString().slice(0, 13) + ':00' // "2026-11-10T22:00" (GMT, as Open-Meteo returns)

const meta: { fetchedAt: string; parts: Record<string, string>; attribution: string[] } = {
  fetchedAt: new Date().toISOString(),
  parts: {},
  attribution: [],
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJSON(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers })
    if (res.ok) return res.json()
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await sleep(2000 * attempt)
      continue
    }
    throw new Error(`${res.status} ${res.statusText} for ${url.replace(/(api_key|key)=[^&]+/gi, '$1=***')}\n${(await res.text()).slice(0, 300)}`)
  }
}

// ---- Wind grid (Open-Meteo) ---------------------------------------------------------------
async function fetchWind() {
  const nx = Math.round((BBOX.east - BBOX.west) / BBOX.step) + 1
  const ny = Math.round((BBOX.north - BBOX.south) / BBOX.step) + 1
  const pts: { lat: number; lon: number }[] = []
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push({ lat: BBOX.south + j * BBOX.step, lon: BBOX.west + i * BBOX.step })

  const speed = new Array(HOURS * nx * ny)
  const dir = new Array(HOURS * nx * ny)
  const CHUNK = 100 // locations per request
  for (let c = 0; c < pts.length; c += CHUNK) {
    const chunk = pts.slice(c, c + CHUNK)
    const url =
      'https://api.open-meteo.com/v1/forecast?' +
      `latitude=${chunk.map((p) => p.lat).join(',')}&longitude=${chunk.map((p) => p.lon).join(',')}` +
      '&hourly=wind_speed_120m,wind_direction_120m&past_days=2&forecast_days=1&wind_speed_unit=ms&timezone=GMT&cell_selection=nearest'
    const data = await getJSON(url)
    const locs = Array.isArray(data) ? data : [data]
    locs.forEach((loc: any, k: number) => {
      const times: string[] = loc.hourly.time
      const first = times.indexOf(isoHour(START))
      if (first < 0) throw new Error(`Open-Meteo response doesn't cover ${isoHour(START)}`)
      for (let h = 0; h < HOURS; h++) {
        const s = loc.hourly.wind_speed_120m[first + h]
        const d = loc.hourly.wind_direction_120m[first + h]
        if (s == null || d == null) throw new Error(`Missing wind at ${chunk[k].lat},${chunk[k].lon} hour ${h}`)
        speed[h * nx * ny + c + k] = Math.round(s * 10) / 10
        dir[h * nx * ny + c + k] = Math.round(d)
      }
    })
    process.stdout.write(`  wind: ${Math.min(c + CHUNK, pts.length)}/${pts.length} grid points\r`)
    await sleep(300)
  }
  writeFileSync(
    new URL('wind.json', OUT),
    JSON.stringify({
      note: 'Open-Meteo forecast API, wind at 120 m. speed m/s; dir = where the wind blows FROM. Layout [hour][row][col].',
      west: BBOX.west, south: BBOX.south, step: BBOX.step, nx, ny,
      start: new Date(START).toISOString(), hours: HOURS, speed, dir,
    }),
  )
  meta.parts.wind = `Open-Meteo, wind at 120 m, ${BBOX.step}° grid, ${isoHour(START)}–${isoHour(NOW_HOUR)} UTC`
  meta.attribution.push('Weather data by Open-Meteo.com (CC BY 4.0)')
  console.log(`\n  wind: ${nx}×${ny} grid × ${HOURS} h ✓`)
}

// ---- Air quality: last 24 h per city ------------------------------------------------------
interface CityAir {
  pm25: number[]
  pm10: number[]
  startHour: number // IST clock hour of the first value
  windKmh: number
  windFrom: number
  source: string
}

const IST = 5.5 * H
const last24 = Array.from({ length: 24 }, (_, i) => NOW_HOUR - (23 - i) * H) // UTC hours, oldest first

async function cityWind(city: CityId) {
  const [lon, lat] = CITIES[city].center
  const d = await getJSON(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`,
  )
  return { windKmh: Math.round(d.current.wind_speed_10m), windFrom: Math.round(d.current.wind_direction_10m) }
}

/** Modelled PM (CAMS via Open-Meteo) at the city centre. */
async function modelAir(city: CityId): Promise<Pick<CityAir, 'pm25' | 'pm10' | 'source'>> {
  const [lon, lat] = CITIES[city].center
  const d = await getJSON(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10&past_days=2&forecast_days=1&timezone=GMT`,
  )
  const idx = last24.map((t) => d.hourly.time.indexOf(isoHour(t)))
  if (idx.some((i: number) => i < 0)) throw new Error('Open-Meteo air quality response missing hours')
  const pick = (arr: (number | null)[]) => idx.map((i: number) => Math.round(arr[i] ?? NaN))
  return { pm25: pick(d.hourly.pm2_5), pm10: pick(d.hourly.pm10), source: 'CAMS model via Open-Meteo (modelled, not measured)' }
}

/** Measured PM: average of CPCB (and other) stations in the city, via OpenAQ v3. */
async function stationAir(city: CityId, key: string): Promise<Pick<CityAir, 'pm25' | 'pm10' | 'source'> | null> {
  const headers = { 'X-API-Key': key }
  const [w, s, e, n] = CITIES[city].bounds
  const locs = await getJSON(`https://api.openaq.org/v3/locations?bbox=${w},${s},${e},${n}&parameters_id=2&limit=1000`, headers)
  const fresh = locs.results.filter((l: any) => l.datetimeLast?.utc && Date.parse(l.datetimeLast.utc) > NOW_HOUR - 6 * H)
  const providers = new Set<string>(fresh.map((l: any) => l.provider?.name).filter(Boolean))
  console.log(`  ${city}: ${fresh.length} stations reporting (providers: ${[...providers].join(', ') || 'unknown'})`)

  const sums = { pm25: last24.map(() => [0, 0]), pm10: last24.map(() => [0, 0]) }
  for (const loc of fresh) {
    for (const sensor of loc.sensors ?? []) {
      const p = sensor.parameter?.name as 'pm25' | 'pm10'
      if (p !== 'pm25' && p !== 'pm10') continue
      await sleep(1100) // free tier: 60 requests/minute
      const res = await getJSON(
        `https://api.openaq.org/v3/sensors/${sensor.id}/hours?datetime_from=${new Date(last24[0]).toISOString()}&datetime_to=${new Date(NOW_HOUR + H).toISOString()}&limit=100`,
        headers,
      )
      for (const r of res.results ?? []) {
        const t = Date.parse(r.period?.datetimeFrom?.utc)
        const i = last24.indexOf(t)
        if (i < 0 || r.value == null || r.value < 0 || r.value > 1500) continue // drop obvious sensor errors
        sums[p][i][0] += r.value
        sums[p][i][1] += 1
      }
    }
  }
  const avg = (rows: number[][]) => rows.map(([sum, count]) => (count ? Math.round(sum / count) : NaN))
  const pm25 = avg(sums.pm25)
  const pm10 = avg(sums.pm10)
  const covered = pm25.filter((v) => !Number.isNaN(v)).length
  if (covered < 18) {
    console.log(`  ${city}: only ${covered}/24 hours of station PM2.5, using the model instead`)
    return null
  }
  // Fill the odd missing hour from its neighbours so the app always gets 24 numbers.
  const fill = (xs: number[]) => xs.map((v, i) => (Number.isNaN(v) ? (xs.slice(0, i).reverse().find((x) => !Number.isNaN(x)) ?? xs.find((x) => !Number.isNaN(x)) ?? 0) : v))
  return {
    pm25: fill(pm25),
    pm10: pm10.some((v) => !Number.isNaN(v)) ? fill(pm10) : fill(pm25).map((v) => Math.round(v * 1.6)),
    source: `Measured: average of ${fresh.length} monitoring stations (${[...providers].join(', ')}) via OpenAQ`,
  }
}

async function fetchAir() {
  const key = process.env.OPENAQ_API_KEY
  if (!key) console.log('  air: no OPENAQ_API_KEY, so using modelled PM (CAMS). Add the key for measured station data.')
  const cities: Record<string, CityAir> = {}
  for (const city of Object.keys(CITIES) as CityId[]) {
    const measured = key ? await stationAir(city, key) : null
    const pm = measured ?? (await modelAir(city))
    cities[city] = { ...pm, startHour: new Date(last24[0] + IST).getUTCHours(), ...(await cityWind(city)) }
    console.log(`  ${city}: 24-h mean PM2.5 ${Math.round(pm.pm25.reduce((a, b) => a + b, 0) / 24)} µg/m³ (${pm.source.split(':')[0]}) ✓`)
  }
  writeFileSync(
    new URL('airtoday.json', OUT),
    JSON.stringify({ end: new Date(NOW_HOUR).toISOString(), timezone: 'Asia/Kolkata', note: 'Last 24 hourly values, oldest first.', cities }, null, 2),
  )
  meta.parts.air = Object.entries(cities).map(([c, v]) => `${c}: ${v.source}`).join('; ')
  if (key) meta.attribution.push('Air quality measurements via OpenAQ (openaq.org), from CPCB and other station operators')
  if (Object.values(cities).some((c) => c.source.startsWith('CAMS')))
    meta.attribution.push('Air quality model data: Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo')
}

// ---- Fires (NASA FIRMS) -------------------------------------------------------------------
async function fetchFires() {
  const key = process.env.FIRMS_MAP_KEY
  if (!key) throw new Error('FIRMS_MAP_KEY is not set in .env (get one free at https://firms.modaps.eosdis.nasa.gov/api/map_key/)')
  const SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT']
  const area = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`
  const fires: { lat: number; lon: number; detectedAt: string; confidence: string }[] = []
  for (const source of SOURCES) {
    // DAY_RANGE is 1–5; 3 days covers our 48-h window whatever the time of day.
    const res = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${area}/3`)
    const text = await res.text()
    if (!res.ok || /invalid/i.test(text.slice(0, 200))) throw new Error(`FIRMS ${source}: ${res.status} ${text.slice(0, 200)}`)
    const [header, ...rows] = text.trim().split('\n')
    const cols = header.split(',')
    const col = (name: string) => {
      const i = cols.indexOf(name)
      if (i < 0) throw new Error(`FIRMS ${source}: expected column "${name}", got: ${header}`)
      return i
    }
    const [iLat, iLon, iDate, iTime, iConf] = ['latitude', 'longitude', 'acq_date', 'acq_time', 'confidence'].map(col)
    let kept = 0
    for (const row of rows) {
      const f = row.split(',')
      const hhmm = f[iTime].padStart(4, '0')
      const t = Date.parse(`${f[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`) // FIRMS times are UTC
      if (!(t >= START - 6 * H && t <= NOW_HOUR + H)) continue
      fires.push({ lat: +f[iLat], lon: +f[iLon], detectedAt: new Date(t).toISOString().replace('.000', ''), confidence: f[iConf] })
      kept++
    }
    console.log(`  fires: ${source} ${kept} detections in window (of ${rows.length}); sample row: ${rows[0] ?? '(none)'}`)
    await sleep(500)
  }
  writeFileSync(new URL('fires.json', OUT), JSON.stringify(fires))
  meta.parts.fires = `NASA FIRMS VIIRS NRT (S-NPP, NOAA-20, NOAA-21), ${fires.length} detections`
  meta.attribution.push('Fire data: NASA FIRMS (LANCE / VIIRS)')
  console.log(`  fires: ${fires.length} total ✓`)
}

// ---- Not yet available as real data -------------------------------------------------------
function copySample(file: string) {
  const data = JSON.parse(readFileSync(new URL(file, MOCK), 'utf8'))
  writeFileSync(new URL(file, OUT), JSON.stringify({ ...data, sample: true }))
}

// ---- Run ----------------------------------------------------------------------------------
const steps: [string, () => Promise<void> | void][] = [
  ['wind', fetchWind],
  ['air', fetchAir],
  ['fires', fetchFires],
  ['sources', () => { copySample('sources.json'); copySample('history.json'); meta.parts.sources = 'SAMPLE (no real source-apportionment data yet)' }],
]
let failed = false
for (const [name, run] of steps) {
  if (!want(name)) continue
  console.log(`→ ${name}`)
  try {
    await run()
  } catch (err) {
    failed = true
    console.error(`  ✗ ${name}: ${(err as Error).message}`)
  }
}
writeFileSync(new URL('meta.json', OUT), JSON.stringify(meta, null, 2))
if (failed) {
  console.error('\nSome parts failed (see above). The app keeps using whatever files are already in public/data/live/.')
  process.exitCode = 1
} else console.log('\nDone. Preview with:  VITE_DATA_MODE=live npm run dev')
