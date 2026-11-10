import { useEffect, useMemo, useRef, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import Counter from '../components/Counter'
import { placePhrase, placeTitle, type Place } from '../lib/geo'
import { loadTraceData, type TraceData } from '../lib/data'
import { backTrajectory, gridEnd, type TrajPoint } from '../lib/trajectory'
import { cumulativeKm, firesPassed, traceStats, type PassedFire, type TraceStats } from '../lib/stats'
import { addTraceLayers, removeTraceLayers, setLitFires, setTrail } from '../lib/traceLayers'

interface Props {
  map: maplibregl.Map | null
  place: Place
  onStats: (stats: TraceStats) => void
  onNext: () => void
}

const ANIMATION_MS = 9000
const REDUCED_MS = 2500

interface Trace {
  points: TrajPoint[]
  cum: number[]
  passed: PassedFire[] // sorted by when the path reaches them
  stats: TraceStats
}

function computeTrace(data: TraceData, place: Place): Trace {
  const points = backTrajectory(data.grid, place.lat, place.lon)
  const passed = firesPassed(points, data.fires, gridEnd(data.grid)).sort((a, b) => a.hoursAgo - b.hoursAgo)
  return { points, cum: cumulativeKm(points), passed, stats: traceStats(points, passed) }
}

const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Screen 2: the air's journey, animated backwards along the wind. */
export default function Trace({ map, place, onStats, onNext }: Props) {
  const reduced = useReducedMotion()
  const [data, setData] = useState<TraceData | null>(null)
  const [error, setError] = useState(false)
  const [done, setDone] = useState(false)
  const [live, setLive] = useState<TraceStats>({ km: 0, fires: 0, hours: 0 })
  const skipRef = useRef(false)

  const load = () => {
    setError(false)
    loadTraceData().then(setData, () => setError(true))
  }
  useEffect(load, [])

  const trace = useMemo(() => (data ? computeTrace(data, place) : null), [data, place])

  useEffect(() => {
    if (trace) onStats(trace.stats)
  }, [trace, onStats])

  // The animation: grow the trail hour by hour, light fires as it passes, follow with the camera.
  useEffect(() => {
    if (!map || !data || !trace) return
    const { points, cum, passed, stats } = trace
    const steps = points.length - 1
    const duration = reduced ? REDUCED_MS : ANIMATION_MS
    const litAt = new Map<number, number>()
    const size = () => ({ w: map.getContainer().clientWidth, h: map.getContainer().clientHeight })
    let raf = 0
    let last = { km: -1, fires: -1, hours: -1 }
    let lastFrame = performance.now()

    addTraceLayers(map, data.fires)
    map.stop()
    map.jumpTo({ center: [place.lon, place.lat], zoom: 10.5 })

    const coordsUpTo = (hoursFloat: number): [number, number][] => {
      const i = Math.floor(hoursFloat)
      const out: [number, number][] = points.slice(0, i + 1).map((p) => [p.lon, p.lat])
      if (i < steps) {
        const f = hoursFloat - i
        out.push([lerp(points[i].lon, points[i + 1].lon, f), lerp(points[i].lat, points[i + 1].lat, f)])
      }
      return out
    }

    const render = (hoursFloat: number, now: number, followCamera: boolean) => {
      const coords = coordsUpTo(hoursFloat)
      setTrail(map, coords, coords.at(-1) ?? null)

      // Light up fires the path has reached.
      for (const p of passed) {
        if (p.hoursAgo > hoursFloat) break
        if (!litAt.has(p.index)) litAt.set(p.index, now)
      }
      setLitFires(
        map,
        passed
          .filter((p) => litAt.has(p.index))
          .map((p) => ({ lon: p.fire.lon, lat: p.fire.lat, age: reduced ? 10 : (now - litAt.get(p.index)!) / 1000 })),
      )

      // Live counters (only re-render React when a number changes).
      const i = Math.min(Math.floor(hoursFloat), steps)
      const km = Math.round(i < steps ? lerp(cum[i], cum[i + 1], hoursFloat - i) : cum[steps])
      const next = { km, fires: litAt.size, hours: Math.floor(hoursFloat) }
      if (next.km !== last.km || next.fires !== last.fires || next.hours !== last.hours) {
        last = next
        setLive(next)
      }

      // Camera follows the head and zooms out as the path grows.
      if (followCamera && coords.length > 1) {
        const lons = coords.map((c) => c[0])
        const lats = coords.map((c) => c[1])
        const { h } = size()
        const target = map.cameraForBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: { top: 110, bottom: Math.min(240, h * 0.3), left: 50, right: 50 }, maxZoom: 10.5 },
        )
        if (target?.center && target.zoom !== undefined) {
          const c = map.getCenter()
          const tc = target.center as { lng: number; lat: number }
          // Time-based smoothing (~120 ms lag), so slow phones follow as tightly as fast ones.
          const k = 1 - Math.exp(-(now - lastFrame) / 120)
          map.jumpTo({ center: [lerp(c.lng, tc.lng, k), lerp(c.lat, tc.lat, k)], zoom: lerp(map.getZoom(), target.zoom, k) })
        }
      }
      lastFrame = now
    }

    const finish = () => {
      render(steps, performance.now(), false)
      setLive({ km: stats.km, fires: stats.fires, hours: stats.hours })
      // End frame: the whole journey in the top half, leaving room for the result card.
      const lons = points.map((p) => p.lon)
      const lats = points.map((p) => p.lat)
      const { h } = size()
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: { top: 90, bottom: Math.round(h * 0.6), left: 40, right: 40 }, duration: reduced ? 0 : 900, maxZoom: 10 },
      )
      setDone(true)
      // Let flares settle after skipping.
      const settle = (now: number) => {
        render(steps, now, false)
        if (passed.some((p) => now - (litAt.get(p.index) ?? 0) < 1500)) raf = requestAnimationFrame(settle)
      }
      raf = requestAnimationFrame(settle)
    }

    const t0 = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      if (skipRef.current || t >= 1) return finish()
      render(easeInOut(t) * steps, now, true)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      removeTraceLayers(map)
    }
  }, [map, data, trace, place, reduced])

  const skip = () => {
    if (!done) skipRef.current = true
  }

  const stats = trace?.stats

  return (
    <div className="pointer-events-auto relative h-full" onClick={skip}>
      <AnimatePresence mode="wait">
        {!done ? (
          <motion.div key="running" className="flex h-full flex-col items-center px-6" exit={{ opacity: 0 }}>
            <motion.p
              className="mt-[calc(env(safe-area-inset-top)+4.5rem)] flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white/80 backdrop-blur-sm"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
              {error ? 'Couldn’t load wind data' : data ? `Following the air ${placePhrase(place)} back in time…` : 'Loading wind data…'}
            </motion.p>

            {error && (
              <button onClick={load} className="cta mt-6">
                Try again
              </button>
            )}

            <div className="mb-[calc(env(safe-area-inset-bottom)+1.5rem)] mt-auto w-full">
              <div className="flex gap-2 rounded-2xl border border-white/10 bg-black/50 px-2 py-3 backdrop-blur-sm">
                <Counter value={live.km} label="km travelled" duration={0.15} />
                <Counter value={live.fires} label="fires passed" duration={0.15} />
                <Counter value={live.hours} label="hours back" duration={0.15} />
              </div>
              <p className="mt-3 text-center text-xs text-white/55">Tap to skip</p>
              <p className="mt-2 text-center text-[11px] leading-snug text-white/40">
                Estimated path based on wind data. Fires shown were detected near the route, not measured contributions.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div key="done" className="flex h-full flex-col items-center px-5">
            <div className="flex-[1.5]" />
            <motion.div
              className="card w-full"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200, delay: reduced ? 0 : 0.35 }}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">
                📍 {placeTitle(place)} · last {stats?.hours ?? 48} h
              </p>
              <h2 className="mt-1.5 text-xl font-semibold leading-snug text-white">
                The air {placePhrase(place)} today travelled <span className="text-amber-300">{stats?.km.toLocaleString('en-IN')} km</span>
                {stats && stats.fires > 0 ? (
                  <>
                    {' '}
                    and passed <span className="text-amber-300">{stats.fires.toLocaleString('en-IN')} fires</span> before reaching you.
                  </>
                ) : (
                  <> before reaching you, without passing any detected fires.</>
                )}
              </h2>

              <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                <Counter value={stats?.km ?? 0} label="km" />
                <Counter value={stats?.fires ?? 0} label="fires" />
                <Counter value={stats?.hours ?? 0} label="hours" />
              </div>

              <motion.button
                onClick={onNext}
                className="cta mt-5 w-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.6 }}
                whileTap={{ scale: 0.97 }}
              >
                What’s in my air? →
              </motion.button>
            </motion.div>
            <p className="mt-3 max-w-[20rem] text-center text-[11px] leading-snug text-white/45">
              Estimated path based on wind data. Fires shown were detected near the route, not measured contributions.
            </p>
            <div className="flex-[0.4]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
