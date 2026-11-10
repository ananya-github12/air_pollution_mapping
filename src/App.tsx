import { lazy, Suspense, useCallback, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { AnimatePresence, motion } from 'framer-motion'
import Question from './screens/Question'
import Trace from './screens/Trace'
import WhatsInIt from './screens/WhatsInIt'
import Numbers from './screens/Numbers'
import SampleBadge from './components/SampleBadge'
import AirParticles from './components/AirParticles'
import { CITIES, findArea } from './config/cities'
import { placeFromArea, type Place } from './lib/geo'
import type { TraceStats } from './lib/stats'

// The map bundle is large; load it after the headline has painted.
const MapView = lazy(() => import('./components/Map'))

type Screen = 'question' | 'trace' | 'inside' | 'numbers'

// Deep link: /?area=aliganj lands straight on the trace.
function initialPlace(): Place | null {
  const area = findArea(new URLSearchParams(window.location.search).get('area'))
  return area ? placeFromArea(area) : null
}

export default function App() {
  const [place, setPlace] = useState<Place | null>(initialPlace)
  const [screen, setScreen] = useState<Screen>(() => (place ? 'trace' : 'question'))
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [traceStats, setTraceStats] = useState<TraceStats | null>(null)

  const pick = useCallback((p: Place) => {
    setPlace(p)
    setTraceStats(null)
    setScreen('trace')
  }, [])

  function restart() {
    const city = CITIES[place?.city ?? 'delhi']
    map?.flyTo({ center: city.center, zoom: city.zoom, duration: 1600 })
    setPlace(null)
    setScreen('question')
    window.history.replaceState(null, '', window.location.pathname)
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b0b0d] text-white">
      <Suspense fallback={null}>
        <MapView initialCity={place?.city} place={place} onReady={setMap} dim={screen !== 'trace'} />
      </Suspense>

      {/* Smoky haze over Screen 1 that clears when the trace starts. */}
      <motion.div
        className="haze pointer-events-none absolute inset-0"
        initial={false}
        animate={{ opacity: screen === 'question' ? 1 : 0 }}
        transition={{ duration: 1.8, ease: 'easeOut' }}
      />
      <div className="scrim pointer-events-none absolute inset-0" />
      <AirParticles />

      <SampleBadge />

      {/* UI column: 390 px-first, centred on desktop while the map stays full-bleed. */}
      <div className="pointer-events-none absolute inset-0 mx-auto w-full max-w-[430px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            className="h-full [&_button]:pointer-events-auto"
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.45 }}
          >
            {screen === 'question' && <Question map={map} onPick={pick} />}
            {screen === 'trace' && place && <Trace map={map} place={place} onStats={setTraceStats} onNext={() => setScreen('inside')} />}
            {screen === 'inside' && place && <WhatsInIt map={map} place={place} firesPassed={traceStats?.fires ?? null} onNext={() => setScreen('numbers')} />}
            {screen === 'numbers' && place && <Numbers place={place} onRestart={restart} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
