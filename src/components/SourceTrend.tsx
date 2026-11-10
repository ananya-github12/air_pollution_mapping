import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Sheet from './Sheet'
import LineChart from './LineChart'
import { SOURCE_LOOK } from '../config/sources'
import { CITIES, type CityId } from '../config/cities'
import { DATA_MODE, loadHistory, sourcesAreSample, type SourceHistory, type SourceShare } from '../lib/data'
import { mean } from '../lib/aqi'

type Range = '1D' | '7D' | '30D'
const RANGES: Range[] = ['1D', '7D', '30D']
const COMPARE: Record<Range, string> = { '1D': 'yesterday', '7D': 'the previous 7 days', '30D': 'the previous 30 days' }

interface Props {
  source: SourceShare | null
  city: CityId
  onClose: () => void
}

// Dates are calendar dates/hours in local (IST) time; do the maths in UTC so the viewer's timezone can't shift them.
const parse = (s: string) => new Date(s.length === 10 ? `${s}T00:00:00Z` : `${s}:00Z`)
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString('en-IN', { timeZone: 'UTC', ...o })
const hourLabel = (d: Date) => fmt(d, { hour: 'numeric', hour12: true }).replace(' ', ' ').toLowerCase()

interface Series {
  values: number[]
  prevMean: number
  ticks: { i: number; label: string }[]
  labelAt: (i: number) => string
  table: { label: string; value: number }[]
}

function series(h: SourceHistory, id: SourceShare['id'], range: Range): Series {
  const hourly = h.hourly.values[id]
  const daily = h.daily.values[id]
  const hStart = parse(h.hourly.start)
  const dStart = parse(h.daily.start)
  const hourAt = (i: number) => new Date(hStart.getTime() + i * 3600e3)
  const dayAt = (i: number) => new Date(dStart.getTime() + i * 86400e3)

  if (range === '1D') {
    const off = hourly.length - 24
    const values = hourly.slice(off)
    return {
      values,
      prevMean: mean(hourly.slice(off - 24, off)),
      ticks: [0, 6, 12, 18, 23].map((i) => ({ i, label: hourLabel(hourAt(off + i)) })),
      labelAt: (i) => `Today, ${hourLabel(hourAt(off + i))}`,
      table: values.map((value, i) => ({ label: hourLabel(hourAt(off + i)), value })),
    }
  }
  if (range === '7D') {
    const days = daily.length
    return {
      values: hourly,
      prevMean: mean(daily.slice(days - 14, days - 7)),
      ticks: Array.from({ length: 7 }, (_, d) => ({ i: d * 24 + 12, label: fmt(hourAt(d * 24), { weekday: 'short' }) })),
      labelAt: (i) => `${fmt(hourAt(i), { weekday: 'short', day: 'numeric', month: 'short' })}, ${hourLabel(hourAt(i))}`,
      table: Array.from({ length: 7 }, (_, d) => ({
        label: fmt(hourAt(d * 24), { weekday: 'short', day: 'numeric', month: 'short' }),
        value: mean(hourly.slice(d * 24, d * 24 + 24)),
      })),
    }
  }
  const off = daily.length - 30
  const values = daily.slice(off)
  return {
    values,
    prevMean: mean(daily.slice(0, off)),
    ticks: [0, 10, 20, 29].map((i) => ({ i, label: fmt(dayAt(off + i), { day: 'numeric', month: 'short' }) })),
    labelAt: (i) => fmt(dayAt(off + i), { weekday: 'short', day: 'numeric', month: 'short' }),
    table: values.map((value, i) => ({ label: fmt(dayAt(off + i), { day: 'numeric', month: 'short' }), value })),
  }
}

/** Bottom sheet: how one source's estimated contribution to PM2.5 has moved over 1 / 7 / 30 days. */
export default function SourceTrend({ source, city, onClose }: Props) {
  const [range, setRange] = useState<Range>('7D')
  const [history, setHistory] = useState<SourceHistory | null>(null)
  const [failed, setFailed] = useState(false)
  const [sample, setSample] = useState(DATA_MODE === 'mock')

  useEffect(() => {
    if (source) loadHistory(city).then(setHistory, () => setFailed(true))
    if (source && DATA_MODE === 'live') sourcesAreSample().then(setSample)
  }, [source, city])

  const s = useMemo(() => (history && source ? series(history, source.id, range) : null), [history, source, range])
  const look = source ? SOURCE_LOOK[source.id] : null
  const cityName = CITIES[city].name

  const avg = s ? mean(s.values) : 0
  const change = s && s.prevMean > 0 ? (avg - s.prevMean) / s.prevMean : 0
  const peakIdx = s ? s.values.indexOf(Math.max(...s.values)) : 0

  return (
    <Sheet open={!!source} onClose={onClose} label={source ? `${source.label} trend` : 'Trend'}>
      {source && look && (
        <div className="overflow-y-auto px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full text-lg" style={{ background: `${look.color}33` }} aria-hidden>
                {look.icon}
              </span>
              <div>
                <h3 className="text-lg font-semibold leading-tight text-[#f0efec]">{source.label}</h3>
                <p className="text-xs text-[#c3c2b7]">Estimated contribution to {cityName}’s PM2.5</p>
              </div>
            </div>
            <button onClick={onClose} className="-mr-2 px-2 py-1 text-sm text-white/50">
              Close
            </button>
          </div>

          {/* Range control */}
          <div className="mt-4 grid grid-cols-3 rounded-full bg-white/[0.06] p-1" role="tablist" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`relative rounded-full py-1.5 text-sm font-medium ${range === r ? 'text-neutral-950' : 'text-white/60'}`}
              >
                {range === r && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-full bg-[#f0efec]" transition={{ type: 'spring', damping: 30, stiffness: 400 }} />}
                <span className="relative">{r === '1D' ? 'Today' : r === '7D' ? '7 days' : '30 days'}</span>
              </button>
            ))}
          </div>

          {failed && <p className="mt-6 text-sm text-white/60">Couldn’t load the trend. Try again in a bit.</p>}
          {!s && !failed && <div className="mt-4 h-[230px] animate-pulse rounded-xl bg-white/5" />}

          {s && (
            <>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="shrink-0 whitespace-nowrap">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[#c3c2b7]">Average</div>
                  <div className="text-2xl font-semibold tabular-nums text-[#f0efec]">
                    {Math.round(avg)} <span className="text-sm font-normal text-[#c3c2b7]">µg/m³</span>
                  </div>
                </div>
                <div className="min-w-0 text-right text-sm leading-snug text-[#c3c2b7]">
                  {Math.abs(change) < 0.03 ? (
                    <>About the same as {COMPARE[range]}</>
                  ) : change >= 1 ? (
                    // Big jumps read better as a multiple than as "+2762%".
                    <>
                      <span className="font-semibold text-[#f0efec]">↑ about {Math.round(change + 1)}×</span> {COMPARE[range]}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-[#f0efec]">
                        {change > 0 ? '↑' : '↓'} {Math.round(Math.abs(change) * 100)}%
                      </span>{' '}
                      {change > 0 ? 'higher' : 'lower'} than {COMPARE[range]}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-12">
                <LineChart
                  key={`${source.id}-${range}`}
                  values={s.values}
                  color={look.color}
                  unit="µg/m³"
                  ticks={s.ticks}
                  labelAt={s.labelAt}
                  summary={`${source.label}, ${range}: average ${Math.round(avg)} µg/m³, peak ${Math.round(s.values[peakIdx])} on ${s.labelAt(peakIdx)}.`}
                />
              </div>

              <p className="mt-2 text-xs text-[#c3c2b7]">
                Peak: <span className="font-medium text-[#f0efec] tabular-nums">{Math.round(s.values[peakIdx])} µg/m³</span> · {s.labelAt(peakIdx)}
              </p>
              <p className="mt-3 text-[11px] leading-snug text-white/40">
                {sample && <span className="font-medium text-amber-100/70">Sample trend for illustration, not real data. </span>}
                Touch and drag the chart to read values. City-wide model estimates of how much of the PM2.5 in the air comes from this source, not emissions measured at the source.
              </p>

              <table className="sr-only">
                <caption>
                  {source.label}, estimated PM2.5 contribution (µg/m³)
                </caption>
                <tbody>
                  {s.table.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{Math.round(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
