import { useEffect, useRef, useState } from 'react'
import { Map as MapLibre, Marker, AttributionControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 resolves its worker next to its own module, which breaks once bundled.
// Point it at the worker file Vite emits instead.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { CITIES, DEFAULT_CITY, type CityId } from '../config/cities'
import type { Place } from '../lib/geo'

setWorkerUrl(workerUrl)

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

interface Props {
  initialCity?: CityId
  /** Where to draw the glowing "you are here" dot. */
  place: Place | null
  /** Called once the map's style has loaded. Screens drive the camera through this instance. */
  onReady: (map: MapLibre) => void
  /** Dims and desaturates the map so text on top stays readable. */
  dim: boolean
}

/** Full-bleed MapLibre map. Loaded lazily so the headline paints before the map bundle arrives. */
export default function MapView({ initialCity = DEFAULT_CITY, place, onReady, dim }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const [map, setMap] = useState<MapLibre | null>(null)

  useEffect(() => {
    const city = CITIES[initialCity]
    const m = new MapLibre({
      container: containerRef.current!,
      style: STYLE_URL,
      center: city.center,
      zoom: city.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Needed later so the share feature can snapshot / record the canvas.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    m.touchZoomRotate.disableRotation()
    m.addControl(new AttributionControl({ compact: true }), 'top-left')
    m.once('load', () => {
      // Compact attribution opens expanded on first load; start it collapsed so it stays out of the way.
      m.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      setMap(m)
      onReadyRef.current(m)
    })
    return () => m.remove()
    // The map is created once; later camera moves are driven by the screens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!map || !place) return
    const el = document.createElement('div')
    el.className = 'loc-dot'
    const marker = new Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, place])

  return (
    // Outer box positions; MapLibre's own CSS sets `position: relative` on the inner container.
    <div
      className="absolute inset-0 transition-[filter] duration-[1500ms] ease-out"
      style={{ filter: dim ? 'brightness(0.55) saturate(0.4)' : 'none' }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
