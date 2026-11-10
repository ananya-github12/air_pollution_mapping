// Trace statistics. Wording rule: fires are "passed" / "along the way", never a measured contribution.
import { haversineKm } from './distance.ts'
import type { TrajPoint } from './trajectory.ts'

export interface Fire {
  lat: number
  lon: number
  t: number // detection time, epoch ms
  confidence: string
}

/** Cumulative km at each point (first entry 0). */
export function cumulativeKm(points: TrajPoint[]): number[] {
  const out = [0]
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon))
  }
  return out
}

export const pathKm = (points: TrajPoint[]) => cumulativeKm(points).at(-1) ?? 0

export interface PassedFire {
  fire: Fire
  index: number // index into the fires array (stable id)
  hoursAgo: number // first point on the path (from the user backwards) where it counted
}

/**
 * Unique fires within `radiusKm` of the path whose detection time is within ±`windowH` hours
 * of when the path was there. `endTime` is when the path is at hoursAgo = 0.
 */
export function firesPassed(points: TrajPoint[], fires: Fire[], endTime: number, radiusKm = 25, windowH = 6): PassedFire[] {
  const out: PassedFire[] = []
  const latPad = radiusKm / 111 + 0.01
  fires.forEach((fire, index) => {
    for (const p of points) {
      if (Math.abs(p.lat - fire.lat) > latPad) continue
      const when = endTime - p.hoursAgo * 3600e3
      if (Math.abs(fire.t - when) > windowH * 3600e3) continue
      if (haversineKm(p.lat, p.lon, fire.lat, fire.lon) <= radiusKm) {
        out.push({ fire, index, hoursAgo: p.hoursAgo })
        return
      }
    }
  })
  return out
}

export interface TraceStats {
  km: number
  fires: number
  hours: number
}

export function traceStats(points: TrajPoint[], passed: PassedFire[]): TraceStats {
  return { km: Math.round(pathKm(points)), fires: passed.length, hours: points.length - 1 }
}
