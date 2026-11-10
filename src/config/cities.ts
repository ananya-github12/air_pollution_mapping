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

// Neighbourhood centres (approximate). Used to name the user's area from their GPS point,
// for the manual area list, and as deep-link slugs (/?area=aliganj).
const LUCKNOW_AREAS: [string, number, number][] = [
  ['Aliganj', 26.893, 80.939],
  ['Alambagh', 26.813, 80.901],
  ['Aminabad', 26.849, 80.923],
  ['Ashiyana', 26.79, 80.914],
  ['Charbagh', 26.832, 80.92],
  ['Chinhat', 26.882, 81.045],
  ['Chowk', 26.87, 80.91],
  ['Gomti Nagar', 26.856, 81.005],
  ['Hazratganj', 26.85, 80.946],
  ['Indira Nagar', 26.873, 80.992],
  ['Jankipuram', 26.933, 80.942],
  ['Mahanagar', 26.877, 80.958],
  ['Rajajipuram', 26.846, 80.88],
  ['Telibagh', 26.781, 80.948],
  ['Thakurganj', 26.879, 80.893],
  ['Vikas Nagar', 26.896, 80.956],
  ['Vrindavan Yojana', 26.775, 80.98],
]

const DELHI_AREAS: [string, number, number][] = [
  ['Anand Vihar', 28.6469, 77.3159],
  ['Bawana', 28.792, 77.048],
  ['Chandni Chowk', 28.6506, 77.2303],
  ['Connaught Place', 28.6315, 77.2167],
  ['Dwarka', 28.5921, 77.046],
  ['Greater Kailash', 28.5482, 77.238],
  ['Hauz Khas', 28.5494, 77.2001],
  ['Jahangirpuri', 28.7259, 77.1633],
  ['Janakpuri', 28.6219, 77.0878],
  ['Karol Bagh', 28.6519, 77.1909],
  ['Lajpat Nagar', 28.5677, 77.2433],
  ['Laxmi Nagar', 28.6304, 77.2773],
  ['Mayur Vihar', 28.6046, 77.2947],
  ['Model Town', 28.7167, 77.19],
  ['Mundka', 28.683, 77.031],
  ['Najafgarh', 28.609, 76.9798],
  ['Narela', 28.8526, 77.0929],
  ['Nehru Place', 28.5491, 77.2533],
  ['Okhla', 28.53, 77.27],
  ['Pitampura', 28.7032, 77.132],
  ['Punjabi Bagh', 28.6683, 77.1314],
  ['Rajouri Garden', 28.6492, 77.122],
  ['RK Puram', 28.566, 77.1767],
  ['Rohini', 28.7495, 77.0565],
  ['Saket', 28.5245, 77.2066],
  ['Shahdara', 28.673, 77.289],
  ['Vasant Kunj', 28.52, 77.158],
]

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const toAreas = (city: CityId, rows: [string, number, number][]): Area[] =>
  rows.map(([name, lat, lon]) => ({ id: slug(name), name, city, lat, lon }))

export const CITIES: Record<CityId, City> = {
  lucknow: {
    id: 'lucknow',
    name: 'Lucknow',
    center: [80.9462, 26.8467],
    zoom: 11.2,
    bounds: [80.78, 26.7, 81.12, 27.02],
    areas: toAreas('lucknow', LUCKNOW_AREAS),
  },
  delhi: {
    id: 'delhi',
    name: 'Delhi',
    center: [77.209, 28.6139],
    zoom: 10.4,
    bounds: [76.84, 28.4, 77.35, 28.88],
    areas: toAreas('delhi', DELHI_AREAS),
  },
}

export const DEFAULT_CITY: CityId = 'delhi'

export const ALL_AREAS: Area[] = [...CITIES.lucknow.areas, ...CITIES.delhi.areas]

export function findArea(id: string | null | undefined): Area | undefined {
  if (!id) return undefined
  return ALL_AREAS.find((a) => a.id === id.toLowerCase())
}
