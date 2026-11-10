import { CITIES, type CityId, type Area } from '../config/cities'

const EARTH_RADIUS_KM = 6371

const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/** Which supported city (if any) contains this point. */
export function cityForPoint(lat: number, lon: number): CityId | undefined {
  for (const city of Object.values(CITIES)) {
    const [w, s, e, n] = city.bounds
    if (lon >= w && lon <= e && lat >= s && lat <= n) return city.id
  }
  return undefined
}

/** Nearest preset area within the given city. */
export function nearestArea(lat: number, lon: number, cityId: CityId): { area: Area; km: number } {
  let best = CITIES[cityId].areas[0]
  let bestKm = Infinity
  for (const area of CITIES[cityId].areas) {
    const km = haversineKm(lat, lon, area.lat, area.lon)
    if (km < bestKm) {
      best = area
      bestKm = km
    }
  }
  return { area: best, km: bestKm }
}

/** The point whose air we trace. */
export interface Place {
  lat: number
  lon: number
  city: CityId
  label: string // used in headlines: "The air in {label} today…"
  areaId: string // nearest preset, used for deep links and mock data
}

export function placeFromArea(area: Area): Place {
  return { lat: area.lat, lon: area.lon, city: area.city, label: area.name, areaId: area.id }
}

/** Builds a Place for an arbitrary point, or undefined if it's outside supported cities. */
export function placeFromPoint(lat: number, lon: number): Place | undefined {
  const city = cityForPoint(lat, lon)
  if (!city) return undefined
  const { area, km } = nearestArea(lat, lon, city)
  const label = km <= 2.5 ? area.name : `your part of ${CITIES[city].name}`
  return { lat, lon, city, label, areaId: area.id }
}

/** [west, south, east, north] box of the given radius around a point. */
export function boxAround(lat: number, lon: number, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111.32
  const dLon = radiusKm / (111.32 * Math.cos(toRad(lat)))
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}
