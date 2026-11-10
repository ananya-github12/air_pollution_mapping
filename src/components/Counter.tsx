import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface CountUpProps {
  value: number
  /** Count-up duration in seconds. */
  duration?: number
  delay?: number
  suffix?: string
  className?: string
}

/** A tabular number that counts up to `value`. */
export function CountUp({ value, duration = 0.6, delay = 0, suffix = '', className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const controls = animate(from.current, value, {
      duration: reduced ? 0 : duration,
      delay: reduced ? 0 : delay,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = Math.round(v).toLocaleString('en-IN') + suffix
      },
    })
    from.current = value
    return () => controls.stop()
  }, [value, duration, delay, suffix, reduced])

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      0{suffix}
    </span>
  )
}

/** Big number with a small label underneath, used for the live trace stats. */
export default function Counter({ value, label, duration = 0.6 }: { value: number; label: string; duration?: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <CountUp value={value} duration={duration} className="text-2xl font-semibold tracking-tight text-amber-100" />
      <span className="mt-1 text-[10px] uppercase leading-tight tracking-[0.1em] text-white/50">{label}</span>
    </div>
  )
}
