import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import ShareButton from '../components/ShareButton'
import { CountUp } from '../components/Counter'
import { CITIES } from '../config/cities'
import { loadAirToday, type AirToday } from '../lib/data'
import { aqiCategory, compass, extremeWindow, formatHourRange, mean, naqi, WHO_PM25_DAILY } from '../lib/aqi'
import { placePhrase, placeTitle, type Place } from '../lib/geo'

interface Props {
  place: Place
  onRestart: () => void
}

const WINDOW_H = 3 // best / worst time are 3-hour windows

/** Screen 4: today's air in numbers. AQI, PM2.5, PM10, best/worst time of day, wind. */
export default function Numbers({ place, onRestart }: Props) {
  const reduced = useReducedMotion()
  const [air, setAir] = useState<AirToday | null>(null)
  const [failed, setFailed] = useState(false)
  const city = CITIES[place.city]

  useEffect(() => {
    loadAirToday(place.city).then(setAir, () => setFailed(true))
  }, [place.city])

  const stats = useMemo(() => {
    if (!air) return null
    const pm25 = mean(air.pm25)
    const pm10 = mean(air.pm10)
    const aqi = naqi(pm25, pm10)
    return {
      aqi,
      cat: aqiCategory(aqi),
      pm25: Math.round(pm25),
      pm10: Math.round(pm10),
      whoTimes: Math.round(pm25 / WHO_PM25_DAILY),
      best: extremeWindow(air.pm25, WINDOW_H, 'min'),
      worst: extremeWindow(air.pm25, WINDOW_H, 'max'),
      peak: Math.max(...air.pm25),
    }
  }, [air])

  const d = (s: number) => (reduced ? 0 : s)

  return (
    <div className="flex h-full flex-col items-center justify-center px-5 py-[calc(env(safe-area-inset-top)+3.5rem)]">
      <motion.div
        className="card w-full"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 200 }}
      >
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">📍 {placeTitle(place)} · today in numbers</p>
        <h2 className="mt-1.5 text-xl font-semibold leading-snug text-white">Your air {placePhrase(place)} today</h2>

        {failed && <p className="mt-4 text-sm text-white/60">Couldn’t load today’s numbers. Try again in a bit.</p>}
        {!stats && !failed && <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white/5" />}

        {stats && air && (
          <>
            {/* AQI ring */}
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={stats.cat.color}
                    strokeWidth="9"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: stats.aqi / 500 }}
                    transition={{ delay: d(0.3), duration: d(1.2), ease: [0.22, 1, 0.36, 1] }}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center leading-none">
                    <CountUp value={stats.aqi} delay={0.3} duration={1.2} className="text-2xl font-bold text-white" />
                    <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/50">avg AQI</div>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <motion.span
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-neutral-950"
                  style={{ background: stats.cat.color }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: d(0.9), type: 'spring', damping: 12 }}
                >
                  {stats.cat.label}
                </motion.span>
                <p className="mt-1.5 text-sm leading-snug text-white/75">{stats.cat.tip}</p>
                <p className="mt-1 text-[11px] text-white/40">India’s national AQI scale, 0–500</p>
              </div>
            </div>

            {/* Tiles */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Tile delay={d(0.45)} label="PM2.5" value={<><CountUp value={stats.pm25} delay={0.45} duration={1} /> <Unit /></>} sub={`${stats.whoTimes}× the WHO daily guideline`} />
              <Tile delay={d(0.55)} label="PM10" value={<><CountUp value={stats.pm10} delay={0.55} duration={1} /> <Unit /></>} sub="coarser dust & smoke" />
              <Tile delay={d(0.65)} label="Cleanest air" value={formatHourRange(stats.best, WINDOW_H)} sub="best time to step out" accent="#86efac" />
              <Tile delay={d(0.75)} label="Haziest air" value={formatHourRange(stats.worst, WINDOW_H)} sub="good time to stay in" accent="#fdba74" />
            </div>

            {/* 24-hour strip */}
            <motion.div className="mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(0.85) }}>
              <div className="flex items-baseline justify-between text-[11px] text-white/50">
                <span>PM2.5 through the day</span>
                <span>
                  Wind {air.windKmh} km/h from the {compass(air.windFrom)}
                </span>
              </div>
              <div className="mt-2 flex h-12 items-end gap-[3px]">
                {air.pm25.map((v, h) => {
                  const inBest = h >= stats.best && h < stats.best + WINDOW_H
                  const inWorst = h >= stats.worst && h < stats.worst + WINDOW_H
                  return (
                    <motion.div
                      key={h}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${Math.max(12, (v / stats.peak) * 100)}%`,
                        background: inBest ? '#86efac' : inWorst ? '#fdba74' : 'rgba(255,255,255,0.18)',
                        originY: 1,
                      }}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: d(0.9 + h * 0.025), duration: d(0.4) }}
                    />
                  )
                })}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-white/35">
                <span>12 am</span>
                <span>6 am</span>
                <span>12 pm</span>
                <span>6 pm</span>
                <span>12 am</span>
              </div>
            </motion.div>
          </>
        )}

        <motion.div
          className="mt-5 flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: d(1.2) }}
        >
          <ShareButton onClick={() => alert('Sharing arrives in the Share milestone.')} />
          <button onClick={onRestart} className="py-2 text-sm text-white/60 underline-offset-4 active:underline">
            Trace another spot
          </button>
        </motion.div>
      </motion.div>

      <p className="mt-3 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
        {city.name}-wide hourly averages, not a reading at your street.
      </p>
    </div>
  )
}

function Unit() {
  return <span className="text-xs font-normal text-white/50">µg/m³</span>
}

function Tile({ label, value, sub, accent, delay }: { label: string; value: React.ReactNode; sub: string; accent?: string; delay: number }) {
  return (
    <motion.div
      className="rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3 py-2.5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-white/50">
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</div>
      <div className="text-[11px] leading-tight text-white/45">{sub}</div>
    </motion.div>
  )
}
