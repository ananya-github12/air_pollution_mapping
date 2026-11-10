import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { motion, useReducedMotion } from 'framer-motion'
import ShareButton from '../components/ShareButton'
import { CountUp } from '../components/Counter'
import { CITIES } from '../config/cities'
import { loadSources, type SourceId, type SourceShare } from '../lib/data'
import type { Place } from '../lib/geo'

interface Props {
  map: maplibregl.Map | null
  place: Place
  onRestart: () => void
}

// Calm, friendly palette: informative, not alarming.
const LOOK: Record<SourceId, { icon: string; color: string }> = {
  'crop-fires': { icon: '🔥', color: '#fbbf24' },
  vehicles: { icon: '🚗', color: '#7dd3fc' },
  dust: { icon: '🏗️', color: '#d6c7a1' },
  industry: { icon: '🏭', color: '#c4b5fd' },
  firecrackers: { icon: '🎆', color: '#f9a8d4' },
  household: { icon: '🍂', color: '#fdba74' },
  other: { icon: '🌫️', color: '#a1a1aa' },
}

/** Screen 3: what's in the air, as estimated city-wide source shares. */
export default function WhatsInIt({ map, place, onRestart }: Props) {
  const reduced = useReducedMotion()
  const [sources, setSources] = useState<SourceShare[] | null>(null)
  const [failed, setFailed] = useState(false)
  const city = CITIES[place.city]

  useEffect(() => {
    loadSources(place.city).then(setSources, () => setFailed(true))
  }, [place.city])

  // Settle the camera back over the city, behind the card.
  useEffect(() => {
    if (!map) return
    map.flyTo({ center: [place.lon, place.lat], zoom: 10.5, duration: reduced ? 0 : 2400, curve: 1.4 })
  }, [map, place, reduced])

  const max = sources ? Math.max(...sources.map((s) => s.share)) : 1

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-[calc(env(safe-area-inset-top)+3.5rem)]">
      <motion.div
        className="card w-full"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">What’s in it</p>
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-white">The air in {place.label} today</h2>
        <p className="mt-1 text-xs text-white/55">Estimated share of {city.name}’s PM2.5 by source</p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {failed && <li className="text-sm text-white/60">Couldn’t load today’s numbers. Try again in a bit.</li>}
          {!sources && !failed && Array.from({ length: 7 }, (_, i) => <li key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />)}
          {sources?.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduced ? 0 : 0.25 + i * 0.09, duration: 0.4 }}
            >
              <div className="flex items-center gap-2.5">
                <motion.span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base"
                  style={{ background: `${LOOK[s.id].color}22` }}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: reduced ? 0 : 0.3 + i * 0.09, type: 'spring', damping: 10, stiffness: 260 }}
                  aria-hidden
                >
                  {LOOK[s.id].icon}
                </motion.span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-white/85">{s.label}</span>
                    <CountUp
                      value={s.share}
                      suffix="%"
                      delay={0.3 + i * 0.09}
                      duration={0.9}
                      className="font-semibold text-white"
                    />
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: LOOK[s.id].color, originX: 0 }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: s.share / max }}
                      transition={{ delay: reduced ? 0 : 0.3 + i * 0.09, duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="mt-5 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.0 }}
        >
          <ShareButton onClick={() => alert('Sharing arrives in the Share milestone.')} />
          <button onClick={onRestart} className="py-2 text-sm text-white/60 underline-offset-4 active:underline">
            Trace another spot
          </button>
        </motion.div>
      </motion.div>

      <p className="mt-3 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
        City-wide estimates from source-apportionment models, not measured at your street. Shares shift day to day.
      </p>
    </div>
  )
}
