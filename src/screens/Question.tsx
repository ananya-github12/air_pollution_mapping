import { useEffect, useState } from 'react'
import type * as maplibregl from 'maplibre-gl'
import { motion } from 'framer-motion'
import AreaPicker from '../components/AreaPicker'
import { placeFromArea, placeFromPoint, type Place } from '../lib/geo'

type Status = 'idle' | 'locating' | 'denied' | 'outside'

interface Props {
  map: maplibregl.Map | null
  onPick: (place: Place) => void
}

const NOTICE: Record<Status, string | null> = {
  idle: null,
  locating: null,
  denied: 'We couldn’t get your location. Pick your area instead.',
  outside: 'You seem to be outside Lucknow and Delhi. Pick an area to explore.',
}

const HEADLINE = ['What', 'air', 'are', 'you', 'breathing?']

export default function Question({ map, onPick }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [pickerOpen, setPickerOpen] = useState(false)

  // Location unavailable or outside our cities: offer the area list straight away.
  function fallBack(reason: 'denied' | 'outside') {
    setStatus(reason)
    setPickerOpen(true)
  }

  // Tap anywhere on the map to pick a point.
  useEffect(() => {
    if (!map) return
    const handler = (e: maplibregl.MapMouseEvent) => {
      const place = placeFromPoint(e.lngLat.lat, e.lngLat.lng)
      if (place) onPick(place)
      else fallBack('outside')
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, onPick])

  function traceMyAir() {
    if (!('geolocation' in navigator)) return fallBack('denied')
    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place = placeFromPoint(pos.coords.latitude, pos.coords.longitude)
        if (place) onPick(place)
        else fallBack('outside')
      },
      () => fallBack('denied'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  const notice = NOTICE[status]

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <motion.span
        className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/60 backdrop-blur-sm"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Lucknow · Delhi
      </motion.span>

      <h1 className="text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)]">
        {HEADLINE.map((word, i) => (
          <motion.span
            key={word}
            className="inline-block whitespace-pre"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.15 + i * 0.09, duration: 0.5, ease: 'easeOut' }}
          >
            {word}
            {i < HEADLINE.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </h1>

      <motion.p
        className="mt-2 max-w-[19rem] text-sm leading-snug text-white/65"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
      >
        Follow today’s air back along the wind, and see what’s in it.
      </motion.p>

      <motion.button
        onClick={traceMyAir}
        disabled={status === 'locating'}
        className="cta cta-breathe mt-7"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.85, type: 'spring', damping: 16, stiffness: 220 }}
        whileTap={{ scale: 0.96 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        {status === 'locating' ? 'Finding you…' : 'Trace my air'}
      </motion.button>

      <motion.button
        onClick={() => setPickerOpen(true)}
        className="mt-3 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-medium text-white/85 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
        whileTap={{ scale: 0.96 }}
      >
        Choose my area instead
      </motion.button>

      <motion.p
        className="mt-3 text-xs text-white/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        {notice ?? 'or tap your spot on the map'}
      </motion.p>

      <AreaPicker
        open={pickerOpen}
        notice={notice}
        onClose={() => setPickerOpen(false)}
        onSelect={(area) => {
          setPickerOpen(false)
          onPick(placeFromArea(area))
        }}
      />
    </div>
  )
}
