import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { motion, useReducedMotion } from 'framer-motion'
import { CountUp } from '../components/Counter'
import { CITIES } from '../config/cities'
import { loadAirToday, loadSources, type SourceShare } from '../lib/data'
import { SOURCE_LOOK } from '../config/sources'
import { mean } from '../lib/aqi'
import SourceTrend from '../components/SourceTrend'
import { placePhrase, placeTitle, type Place } from '../lib/geo'

interface Props {
  map: maplibregl.Map | null
  place: Place
  onNext: () => void
}

/** Screen 3: what's in the air, as estimated city-wide source shares. */
export default function WhatsInIt({ map, place, onNext }: Props) {
  const reduced = useReducedMotion()
  const [sources, setSources] = useState<SourceShare[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [pm25, setPm25] = useState<number | null>(null)
  const [selected, setSelected] = useState<SourceShare | null>(null)
  const city = CITIES[place.city]

  useEffect(() => {
    loadSources(place.city).then(setSources, () => setFailed(true))
    loadAirToday(place.city).then((a) => setPm25(Math.round(mean(a.pm25))), () => {})
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
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">📍 {placeTitle(place)} · what’s in it</p>
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-white">What’s in the air {placePhrase(place)}?</h2>
        <p className="mt-1 text-xs text-white/55">
          {pm25 !== null && (
            <>
              Today’s average PM2.5: <span className="font-semibold text-white/85 tabular-nums">{pm25} µg/m³</span>.{' '}
            </>
          )}
          Estimated share by source, {city.name}-wide. Tap one to see its trend.
        </p>

        <ul className="mt-3 flex flex-col gap-1">
          {failed && <li className="text-sm text-white/60">Couldn’t load today’s numbers. Try again in a bit.</li>}
          {!sources && !failed && Array.from({ length: 7 }, (_, i) => <li key={i} className="h-8 animate-pulse rounded-lg bg-white/5" />)}
          {sources?.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduced ? 0 : 0.25 + i * 0.09, duration: 0.4 }}
            >
              <button
                onClick={() => setSelected(s)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-xl px-2 py-1 text-left active:bg-white/[0.06]"
                aria-label={`${s.label}, ${s.share}%. See trend`}
              >
                <motion.span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base"
                  style={{ background: `${SOURCE_LOOK[s.id].color}22` }}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: reduced ? 0 : 0.3 + i * 0.09, type: 'spring', damping: 10, stiffness: 260 }}
                  aria-hidden
                >
                  {SOURCE_LOOK[s.id].icon}
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
                      style={{ background: SOURCE_LOOK[s.id].color, originX: 0 }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: s.share / max }}
                      transition={{ delay: reduced ? 0 : 0.3 + i * 0.09, duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
                <span className="text-white/30" aria-hidden>
                  ›
                </span>
              </button>
            </motion.li>
          ))}
        </ul>

        <motion.div
          className="mt-5 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 1.0 }}
        >
          <motion.button onClick={onNext} className="cta w-full" whileTap={{ scale: 0.97 }}>
            See today’s numbers →
          </motion.button>
        </motion.div>
      </motion.div>

      <SourceTrend source={selected} city={place.city} onClose={() => setSelected(null)} />

      <p className="mt-3 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
        City-wide estimates from source-apportionment models, not measured at your street. Shares shift day to day.
      </p>
    </div>
  )
}
