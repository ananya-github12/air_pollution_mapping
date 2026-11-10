import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

interface Props {
  values: number[]
  color: string
  unit: string
  /** Axis ticks: data index → short label. */
  ticks: { i: number; label: string }[]
  /** Tooltip label for a data index, e.g. "Sun 8 Nov, 10 pm". */
  labelAt: (i: number) => string
  /** Accessible one-line summary of the chart. */
  summary: string
}

const H = 180
const PAD = { top: 12, right: 10, bottom: 22, left: 34 }

/** Round up to a "nice" axis maximum (1, 2, 2.5, 5 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

/** Single-series line chart with a touch/hover crosshair. Plain SVG, no chart library. */
export default function LineChart({ values, color, unit, ticks, labelAt, summary }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  const [active, setActive] = useState<number | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const max = niceMax(Math.max(...values))
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH

  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const area = `${line}L${x(values.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
  const gradId = `fill-${color.slice(1)}`
  const last = values.length - 1
  const shown = active ?? last

  function indexFromClientX(clientX: number) {
    const rect = wrapRef.current!.getBoundingClientRect()
    const t = (clientX - rect.left - PAD.left) / innerW
    return Math.min(last, Math.max(0, Math.round(t * last)))
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? last) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  // Tooltip position, clamped inside the chart.
  const tipLeft = Math.min(Math.max(x(shown), 70), width - 70)

  return (
    <div ref={wrapRef} className="relative select-none" style={{ touchAction: 'pan-y' }}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={summary}
        tabIndex={0}
        className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        onPointerDown={(e) => setActive(indexFromClientX(e.clientX))}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && setActive(indexFromClientX(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive grid + y labels */}
        {[0, max / 2, max].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
            <text x={PAD.left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="rgba(240,239,236,0.45)" className="tabular-nums">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t.i} x={x(t.i)} y={H - 6} textAnchor={t.i === 0 ? 'start' : t.i === last ? 'end' : 'middle'} fontSize="10" fill="rgba(240,239,236,0.45)">
            {t.label}
          </text>
        ))}

        <motion.path d={area} fill={`url(#${gradId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.6, delay: reduced ? 0 : 0.3 }} />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Crosshair + marker (marker rests on the latest value when idle) */}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} stroke="rgba(240,239,236,0.35)" strokeWidth="1" />}
        <circle cx={x(shown)} cy={y(values[shown])} r="5" fill={color} stroke="#1a1a19" strokeWidth="2" />
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-lg border border-white/10 bg-[#262624] px-2.5 py-1.5 text-center shadow-lg"
          style={{ left: tipLeft }}
        >
          <div className="text-sm font-semibold tabular-nums text-[#f0efec]">
            {Math.round(values[active])} <span className="text-[11px] font-normal text-[#c3c2b7]">{unit}</span>
          </div>
          <div className="text-[11px] text-[#c3c2b7]">{labelAt(active)}</div>
        </div>
      )}
    </div>
  )
}
