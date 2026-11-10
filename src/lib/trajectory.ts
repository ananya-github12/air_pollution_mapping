// Simple, honest back-trajectory: follow the wind backwards one hour at a time.
// Runs in the browser for any point, and in Node for the unit tests (no runtime imports).
import { M_PER_DEG } from './distance.ts'

/** Wind grid as stored in /data/{mode}/wind.json (what Open-Meteo gives us: speed + direction). */
export interface RawWindGrid {
  west: number // longitude of the first column
  south: number // latitude of the first row
  step: number // grid spacing, degrees
  nx: number // columns (longitudes)
  ny: number // rows (latitudes)
  start: string // ISO time of the first hour
  hours: number // number of hourly frames, oldest first
  /** m/s, flattened [hour][row][col] */
  speed: number[]
  /** meteorological direction in degrees: where the wind blows FROM. Same layout as speed. */
  dir: number[]
}

/** Same grid, converted to vector components so it can be interpolated safely across 0°/360°. */
export interface WindGrid {
  west: number
  south: number
  step: number
  nx: number
  ny: number
  start: number // epoch ms of hour 0
  hours: number
  u: Float32Array // m/s toward the east the air is moving
  v: Float32Array // m/s toward the north the air is moving
}

export interface TrajPoint {
  lat: number
  lon: number
  hoursAgo: number
}

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Speed + "from" direction → the (u, v) vector of where the air is heading. */
export function toUV(speed: number, dirFrom: number): { u: number; v: number } {
  const r = toRad(dirFrom)
  return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) }
}

export function gridFromRaw(raw: RawWindGrid): WindGrid {
  const n = raw.speed.length
  const u = new Float32Array(n)
  const v = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const w = toUV(raw.speed[k], raw.dir[k])
    u[k] = w.u
    v[k] = w.v
  }
  return { west: raw.west, south: raw.south, step: raw.step, nx: raw.nx, ny: raw.ny, start: Date.parse(raw.start), hours: raw.hours, u, v }
}

/** Latest time the grid covers (epoch ms). Trajectories start here. */
export const gridEnd = (g: WindGrid) => g.start + (g.hours - 1) * 3600e3

/**
 * Wind at a position for one hourly frame, bilinearly interpolated between the four
 * surrounding grid points. Returns null outside the grid.
 */
export function windAt(g: WindGrid, lat: number, lon: number, hour: number): { u: number; v: number } | null {
  const fx = (lon - g.west) / g.step
  const fy = (lat - g.south) / g.step
  if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1 || hour < 0 || hour >= g.hours) return null
  const i = Math.min(Math.floor(fx), g.nx - 2)
  const j = Math.min(Math.floor(fy), g.ny - 2)
  const tx = fx - i
  const ty = fy - j
  const base = hour * g.nx * g.ny
  const at = (arr: Float32Array, ii: number, jj: number) => arr[base + jj * g.nx + ii]
  const lerp2 = (arr: Float32Array) =>
    (at(arr, i, j) * (1 - tx) + at(arr, i + 1, j) * tx) * (1 - ty) + (at(arr, i, j + 1) * (1 - tx) + at(arr, i + 1, j + 1) * tx) * ty
  return { u: lerp2(g.u), v: lerp2(g.v) }
}

/**
 * One step backwards in time: the air at (lat, lon) arrived riding a wind of (u, v),
 * so `seconds` earlier it was upwind, i.e. displaced by -(u, v) × seconds.
 * (Equivalently: it moves toward the bearing the wind blows FROM.)
 */
export function backStep(lat: number, lon: number, u: number, v: number, seconds = 3600): { lat: number; lon: number } {
  const dNorth = -v * seconds
  const dEast = -u * seconds
  return {
    lat: lat + dNorth / M_PER_DEG,
    lon: lon + dEast / (M_PER_DEG * Math.cos(toRad(lat))),
  }
}

/**
 * Back-trajectory from a point, starting at the grid's most recent hour and stepping back one
 * hour at a time, up to `maxSteps` hours. Stops early if the path leaves the grid.
 */
export function backTrajectory(g: WindGrid, lat: number, lon: number, maxSteps = 48): TrajPoint[] {
  const points: TrajPoint[] = [{ lat, lon, hoursAgo: 0 }]
  let cur = { lat, lon }
  for (let k = 0; k < maxSteps; k++) {
    const wind = windAt(g, cur.lat, cur.lon, g.hours - 1 - k)
    if (!wind) break
    const next = backStep(cur.lat, cur.lon, wind.u, wind.v)
    if (!windAt(g, next.lat, next.lon, Math.max(0, g.hours - 2 - k))) break // left the grid
    cur = next
    points.push({ ...cur, hoursAgo: k + 1 })
  }
  return points
}
