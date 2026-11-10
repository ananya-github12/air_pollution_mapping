import { DATA_MODE } from '../lib/data'

/** Small, unobtrusive badge shown on every screen while mock data is in use. */
export default function SampleBadge() {
  if (DATA_MODE !== 'mock') return null
  return (
    <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/55 backdrop-blur-sm">
      Sample data
    </div>
  )
}
