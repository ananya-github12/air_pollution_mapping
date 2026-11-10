// Generates SAMPLE source-contribution history for the prototype (Phase 1).
//   node scripts/make-mock-history.mjs
// Writes public/data/mock/history.json and rewrites the shares in public/data/mock/sources.json
// so the breakdown, the trend charts and today's PM2.5 all agree.
// Values are estimated contribution to PM2.5 in µg/m³. Deterministic (seeded), so re-runs match.
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = new URL('../public/data/mock/', import.meta.url)
const airToday = JSON.parse(readFileSync(new URL('airtoday.json', DIR)))
const sourcesFile = JSON.parse(readFileSync(new URL('sources.json', DIR)))

const SOURCES = ['crop-fires', 'vehicles', 'dust', 'industry', 'firecrackers', 'household', 'other']
const DAYS = 60 // daily history (30 shown + 30 to compare against)
const HOURLY_DAYS = 7 // hourly history at the end
const TODAY = new Date(Date.UTC(2026, 10, 10)) // 10 Nov 2026
const DIWALI = 57 // day index of 8 Nov 2026 (today is index 59)

// Seeded PRNG (mulberry32)
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gauss = (x, mu, sigma) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const r1 = (x) => Math.round(x * 10) / 10
const dateOf = (i) => new Date(TODAY.getTime() - (DAYS - 1 - i) * 86400000)

// Daily shape per source (arbitrary units; rescaled so today matches airtoday.json).
const CITY = {
  delhi: { crop: 95, veh: 38, dust: 30, ind: 22, crackers: 70, house: [8, 20], other: [24, 40] },
  lucknow: { crop: 38, veh: 36, dust: 32, ind: 15, crackers: 45, house: [12, 24], other: [18, 30] },
}

function daily(cityId, rand) {
  const c = CITY[cityId]
  const out = Object.fromEntries(SOURCES.map((s) => [s, []]))
  for (let t = 0; t < DAYS; t++) {
    const n = () => 1 + (rand() - 0.5) * 0.16
    const sunday = dateOf(t).getUTCDay() === 0
    const season = t / (DAYS - 1)
    out['crop-fires'].push((3 + c.crop * gauss(t, 55, 8)) * n())
    out.vehicles.push(c.veh * (1 + 0.35 * season) * (sunday ? 0.82 : 1) * n())
    out.dust.push(c.dust * n())
    out.industry.push(c.ind * (1 + 0.15 * season) * n())
    const crackers = { [DIWALI - 1]: 0.09, [DIWALI]: 1, [DIWALI + 1]: 0.36, [DIWALI + 2]: 0.12 }[t] ?? 0.008
    out.firecrackers.push(c.crackers * crackers * n())
    out.household.push((c.house[0] + (c.house[1] - c.house[0]) * season) * n())
    out.other.push((c.other[0] + (c.other[1] - c.other[0]) * season) * n())
  }
  return out
}

// Hour-of-day shapes (normalised to mean 1 below).
const PROFILE = {
  'crop-fires': (h) => 1.2 + 0.5 * gauss(h, 5, 4) - 0.6 * gauss(h, 15, 3),
  vehicles: (h) => 0.5 + gauss(h, 9, 1.6) + 1.1 * gauss(h, 19.5, 2) + 0.2 * gauss(h, 13, 3),
  dust: (h) => 0.6 + gauss(h, 13, 3.5),
  industry: (h) => 1 + 0.2 * gauss(h, 3, 4),
  firecrackers: (h) => 0.15 + 3 * gauss(h, 22, 2) + 1.5 * gauss(h, 0, 1.5),
  household: (h) => 0.4 + gauss(h, 20, 2) + 0.7 * gauss(h, 7, 1.5),
  other: (h) => 1.2 + 0.4 * gauss(h, 4, 4) - 0.5 * gauss(h, 15, 3),
}
const SHAPES = Object.fromEntries(
  SOURCES.map((s) => {
    const raw = Array.from({ length: 24 }, (_, h) => Math.max(0.05, PROFILE[s](h)))
    const m = mean(raw)
    return [s, raw.map((v) => v / m)]
  }),
)

const history = { unit: 'µg/m³', note: 'SAMPLE data: estimated contribution to PM2.5 by source.', cities: {} }

for (const cityId of Object.keys(CITY)) {
  const rand = rng(cityId === 'delhi' ? 11 : 29)
  const d = daily(cityId, rand)

  // Scale so today's total matches today's mean PM2.5.
  const todayTarget = mean(airToday.cities[cityId].pm25)
  const k = todayTarget / SOURCES.reduce((a, s) => a + d[s][DAYS - 1], 0)
  for (const s of SOURCES) d[s] = d[s].map((v) => v * k)

  // Hourly for the last 7 days: daily value × hour-of-day shape × a little noise.
  const hourly = Object.fromEntries(SOURCES.map((s) => [s, []]))
  for (let day = DAYS - HOURLY_DAYS; day < DAYS; day++) {
    for (let h = 0; h < 24; h++) {
      for (const s of SOURCES) hourly[s].push(d[s][day] * SHAPES[s][h] * (1 + (rand() - 0.5) * 0.14))
    }
  }
  // Today: make sources sum exactly to the hourly PM2.5 in airtoday.json.
  const base = (HOURLY_DAYS - 1) * 24
  airToday.cities[cityId].pm25.forEach((total, h) => {
    const sum = SOURCES.reduce((a, s) => a + hourly[s][base + h], 0)
    for (const s of SOURCES) hourly[s][base + h] *= total / sum
  })
  // Keep daily values consistent with the hourly ones where both exist.
  for (let i = 0; i < HOURLY_DAYS; i++) {
    for (const s of SOURCES) d[s][DAYS - HOURLY_DAYS + i] = mean(hourly[s].slice(i * 24, i * 24 + 24))
  }

  const iso = (dt) => dt.toISOString().slice(0, 10)
  history.cities[cityId] = {
    daily: { start: iso(dateOf(0)), values: Object.fromEntries(SOURCES.map((s) => [s, d[s].map(r1)])) },
    hourly: { start: `${iso(dateOf(DAYS - HOURLY_DAYS))}T00:00`, values: Object.fromEntries(SOURCES.map((s) => [s, hourly[s].map(r1)])) },
  }

  // Today's shares (largest-remainder rounding so they sum to 100).
  const today = SOURCES.map((s) => d[s][DAYS - 1])
  const total = today.reduce((a, b) => a + b, 0)
  const exact = today.map((v) => (v / total) * 100)
  const shares = exact.map(Math.floor)
  exact
    .map((v, i) => [v - Math.floor(v), i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, 100 - shares.reduce((a, b) => a + b, 0))
    .forEach(([, i]) => shares[i]++)
  for (const row of sourcesFile.cities[cityId]) row.share = shares[SOURCES.indexOf(row.id)]
}

writeFileSync(new URL('history.json', DIR), JSON.stringify(history))
writeFileSync(new URL('sources.json', DIR), JSON.stringify(sourcesFile, null, 2) + '\n')
for (const [c, rows] of Object.entries(sourcesFile.cities)) console.log(c, rows.map((r) => `${r.id} ${r.share}%`).join(', '))
