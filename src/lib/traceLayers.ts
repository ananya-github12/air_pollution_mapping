// MapLibre sources/layers for the trace. Everything is drawn into the map canvas (no DOM markers)
// so the Share step can record the canvas as a video later.
import type { Map as MapLibre, GeoJSONSource } from 'maplibre-gl'
import type { Fire } from './stats.ts'

const SOURCES = ['trace-fires', 'trace-fires-lit', 'trace-trail', 'trace-head'] as const
const LAYERS = ['trace-fires-dim', 'trace-trail-glow', 'trace-trail', 'trace-fires-flare', 'trace-fires-core', 'trace-head-glow', 'trace-head-core']

type LngLat = [number, number]

export function addTraceLayers(map: MapLibre, fires: Fire[]) {
  removeTraceLayers(map)
  map.addSource('trace-fires', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: fires.map((f) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })),
    },
  })
  map.addSource('trace-fires-lit', { type: 'geojson', data: emptyFC() })
  map.addSource('trace-trail', { type: 'geojson', data: emptyFC() })
  map.addSource('trace-head', { type: 'geojson', data: emptyFC() })

  // All recent fires as faint embers; the ones the air passes light up.
  map.addLayer({
    id: 'trace-fires-dim',
    type: 'circle',
    source: 'trace-fires',
    paint: { 'circle-radius': 1.8, 'circle-color': '#f59e0b', 'circle-opacity': 0.28, 'circle-blur': 0.3 },
  })
  map.addLayer({
    id: 'trace-trail-glow',
    type: 'line',
    source: 'trace-trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#f97316', 'line-width': 12, 'line-blur': 9, 'line-opacity': 0.55 },
  })
  map.addLayer({
    id: 'trace-trail',
    type: 'line',
    source: 'trace-trail',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#fcd34d', 'line-width': 2.5, 'line-opacity': 0.95 },
  })
  // Flare: big soft burst when first lit (age 0 s), settling into a small glow.
  map.addLayer({
    id: 'trace-fires-flare',
    type: 'circle',
    source: 'trace-fires-lit',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'age'], 0, 4, 0.25, 20, 1.2, 8],
      'circle-color': '#fb923c',
      'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.9, 1.2, 0.35],
      'circle-blur': 0.8,
    },
  })
  map.addLayer({
    id: 'trace-fires-core',
    type: 'circle',
    source: 'trace-fires-lit',
    paint: { 'circle-radius': 2.8, 'circle-color': '#fde68a' },
  })
  map.addLayer({
    id: 'trace-head-glow',
    type: 'circle',
    source: 'trace-head',
    paint: { 'circle-radius': 16, 'circle-color': '#fbbf24', 'circle-opacity': 0.45, 'circle-blur': 1 },
  })
  map.addLayer({
    id: 'trace-head-core',
    type: 'circle',
    source: 'trace-head',
    paint: { 'circle-radius': 5, 'circle-color': '#fff7ed', 'circle-stroke-color': '#fbbf24', 'circle-stroke-width': 2 },
  })
}

export function removeTraceLayers(map: MapLibre) {
  if (!map.getStyle()) return
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id)
  for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id)
}

export function setTrail(map: MapLibre, coords: LngLat[], head: LngLat | null) {
  ;(map.getSource('trace-trail') as GeoJSONSource | undefined)?.setData(
    coords.length > 1 ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } : emptyFC(),
  )
  ;(map.getSource('trace-head') as GeoJSONSource | undefined)?.setData(
    head ? { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: head } } : emptyFC(),
  )
}

/** Lit fires with their age in seconds since lighting up (drives the flare). */
export function setLitFires(map: MapLibre, lit: { lon: number; lat: number; age: number }[]) {
  ;(map.getSource('trace-fires-lit') as GeoJSONSource | undefined)?.setData({
    type: 'FeatureCollection',
    features: lit.map((f) => ({ type: 'Feature', properties: { age: f.age }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } })),
  })
}

function emptyFC(): { type: 'FeatureCollection'; features: [] } {
  return { type: 'FeatureCollection', features: [] }
}
