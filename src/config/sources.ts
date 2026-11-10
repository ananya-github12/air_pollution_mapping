import type { SourceId } from '../lib/data'

/**
 * Identity colour + icon per source, in a FIXED order (never by rank), so a source keeps its
 * colour everywhere. Colours are the validated dark-mode categorical steps from the dataviz
 * reference palette. Every use also shows the source's label and icon, so colour is never the
 * only way to tell sources apart.
 */
export const SOURCE_LOOK: Record<SourceId, { icon: string; color: string }> = {
  vehicles: { icon: '🚗', color: '#3987e5' },
  'crop-fires': { icon: '🔥', color: '#d95926' },
  household: { icon: '🍂', color: '#199e70' },
  dust: { icon: '🏗️', color: '#c98500' },
  firecrackers: { icon: '🎆', color: '#d55181' },
  industry: { icon: '🏭', color: '#9085e9' },
  other: { icon: '🌫️', color: '#8a8a85' },
}
