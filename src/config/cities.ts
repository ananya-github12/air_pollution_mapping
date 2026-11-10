export type CityId = 'lucknow' | 'delhi'

export interface Area {
  id: string // slug used in deep links, e.g. /?area=aliganj
  name: string
  city: CityId
  lat: number
  lon: number
}

export interface City {
  id: CityId
  name: string
  center: [number, number] // [lon, lat]
  zoom: number
  // [west, south, east, north]: a point inside this box counts as "in the city"
  bounds: [number, number, number, number]
  areas: Area[]
}

export const CITIES: Record<CityId, City> = {
  lucknow: {
    id: 'lucknow',
    name: 'Lucknow',
    center: [80.9462, 26.8467],
    zoom: 11.2,
    bounds: [80.78, 26.7, 81.12, 27.02],
    areas: [
      { id: 'aliganj', name: 'Aliganj', city: 'lucknow', lat: 26.893, lon: 80.939 },
      { id: 'gomti-nagar', name: 'Gomti Nagar', city: 'lucknow', lat: 26.856, lon: 81.005 },
      { id: 'hazratganj', name: 'Hazratganj', city: 'lucknow', lat: 26.85, lon: 80.946 },
      { id: 'chowk', name: 'Chowk', city: 'lucknow', lat: 26.87, lon: 80.91 },
    ],
  },
  delhi: {
    id: 'delhi',
    name: 'Delhi',
    center: [77.209, 28.6139],
    zoom: 10.4,
    bounds: [76.84, 28.4, 77.35, 28.88],
    areas: [
      { id: 'anand-vihar', name: 'Anand Vihar', city: 'delhi', lat: 28.6469, lon: 77.3159 },
      { id: 'connaught-place', name: 'Connaught Place', city: 'delhi', lat: 28.6315, lon: 77.2167 },
      { id: 'dwarka', name: 'Dwarka', city: 'delhi', lat: 28.5921, lon: 77.046 },
      { id: 'rohini', name: 'Rohini', city: 'delhi', lat: 28.7495, lon: 77.0565 },
    ],
  },
}

export const DEFAULT_CITY: CityId = 'delhi'

export const ALL_AREAS: Area[] = [...CITIES.lucknow.areas, ...CITIES.delhi.areas]

export function findArea(id: string | null | undefined): Area | undefined {
  if (!id) return undefined
  return ALL_AREAS.find((a) => a.id === id.toLowerCase())
}
