import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { CITIES, type Area } from '../config/cities'

interface Props {
  open: boolean
  /** Optional line shown above the list, e.g. why we couldn't use their location. */
  notice?: string | null
  onClose: () => void
  onSelect: (area: Area) => void
}

/** Bottom sheet with a searchable list of areas, grouped by city. */
export default function AreaPicker({ open, notice, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(CITIES)
      .map((city) => ({
        city,
        areas: city.areas.filter((a) => !q || a.name.toLowerCase().includes(q) || city.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.areas.length > 0)
  }, [query])

  return (
    <Sheet open={open} onClose={onClose} label="Choose your area">
            <div className="px-5 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Choose your area</h3>
                <button onClick={onClose} className="-mr-2 px-2 py-1 text-sm text-white/50" aria-label="Close">
                  Close
                </button>
              </div>
              {notice && <p className="mt-1 text-sm text-white/55">{notice}</p>}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search areas in Lucknow or Delhi"
                className="mt-3 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 text-[16px] text-white placeholder:text-white/35 focus:border-amber-300/60 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
              {groups.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-white/50">
                  No match. We cover Lucknow and Delhi for now. You can also tap your spot on the map.
                </p>
              )}
              {groups.map(({ city, areas }) => (
                <div key={city.id} className="mt-2">
                  <p className="sticky top-0 bg-neutral-900/95 px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
                    {city.name}
                  </p>
                  <ul>
                    {areas.map((area) => (
                      <li key={area.id}>
                        <button
                          onClick={() => onSelect(area)}
                          className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-left text-[15px] text-white/90 active:bg-white/10"
                        >
                          {area.name}
                          <span className="text-white/25">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
    </Sheet>
  )
}
