import { useMemo } from 'react'

/**
 * Soft motes of air drifting across the screen. Pure CSS, so it costs almost nothing on phones.
 * Hidden entirely when the user prefers reduced motion (see index.css).
 */
export default function AirParticles({ count = 26 }: { count?: number }) {
  // Deterministic pseudo-random layout so particles don't jump between renders.
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
        return {
          left: `${r(1) * 100}%`,
          top: `${r(2) * 100}%`,
          size: 2 + r(3) * 4,
          duration: 14 + r(4) * 16,
          delay: -r(5) * 30,
          warm: r(6) > 0.55,
        }
      }),
    [count],
  )

  return (
    <div className="air-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {motes.map((m, i) => (
        <span
          key={i}
          className={`mote ${m.warm ? 'mote-warm' : ''}`}
          style={{
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            animationDuration: `${m.duration}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
