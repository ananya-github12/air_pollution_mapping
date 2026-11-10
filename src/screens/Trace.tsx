import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Counter from '../components/Counter'
import { placePhrase, placeTitle, type Place } from '../lib/geo'

interface Props {
  map: maplibregl.Map | null
  place: Place
  onNext: () => void
}

const ANIMATION_MS = 9000

/**
 * Screen 2: the journey. PLACEHOLDER: the camera zooms out over ~9 s to stand in for the
 * backward trace; the real path, fire flares and live counters arrive in Milestone 2.
 */
export default function Trace({ map, place, onNext }: Props) {
  const reduced = useReducedMotion()
  const [done, setDone] = useState(false)
  const duration = reduced ? 2500 : ANIMATION_MS

  useEffect(() => {
    if (!map) return
    map.jumpTo({ center: [place.lon, place.lat], zoom: 12 })
    map.easeTo({ zoom: 6.5, duration, easing: (t: number) => t })
    const timer = setTimeout(() => setDone(true), duration)
    return () => clearTimeout(timer)
  }, [map, place, duration])

  function skip() {
    if (done) return
    map?.stop()
    map?.jumpTo({ zoom: 6.5 })
    setDone(true)
  }

  return (
    <div className="pointer-events-auto relative h-full" onClick={skip}>
      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="running" className="flex h-full flex-col items-center px-6" exit={{ opacity: 0 }}>
            <motion.p
              className="mt-[calc(env(safe-area-inset-top)+4.5rem)] flex items-center gap-2 text-sm text-white/75"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              Following the air {placePhrase(place)} back in time…
            </motion.p>

            <div className="mt-auto mb-[calc(env(safe-area-inset-bottom)+1.5rem)] w-full">
              <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/45 px-2 py-3 backdrop-blur-sm">
                <Counter value={0} label="km travelled" />
                <Counter value={0} label="fires passed" />
                <Counter value={0} label="hours in transit" />
              </div>
              <p className="mt-3 text-center text-xs text-white/55">Tap to skip</p>
              <p className="mt-2 text-center text-[11px] leading-snug text-white/40">
                Estimated path based on wind data. Fires shown were detected near the route, not measured contributions.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" className="flex h-full flex-col items-center px-5">
            <div className="flex-[1.15]" />
            <motion.div
              className="card w-full"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">📍 {placeTitle(place)} · last 48 h</p>
              <h2 className="mt-1.5 text-xl font-semibold leading-snug text-white">
                The air {placePhrase(place)} today travelled <span className="text-amber-300">— km</span> and passed{' '}
                <span className="text-amber-300">— fires</span> before reaching you.
              </h2>

              <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                <Counter value={0} label="km" />
                <Counter value={0} label="fires" />
                <Counter value={0} label="hours" />
              </div>

              <motion.button
                onClick={onNext}
                className="cta mt-5 w-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                whileTap={{ scale: 0.97 }}
              >
                What’s in my air? →
              </motion.button>
            </motion.div>
            <p className="mt-3 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
              Estimated path based on wind data. Fires shown were detected near the route, not measured contributions.
            </p>
            <div className="flex-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
