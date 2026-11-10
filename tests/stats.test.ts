import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cumulativeKm, firesPassed, pathKm, traceStats, type Fire } from '../src/lib/stats.ts'
import type { TrajPoint } from '../src/lib/trajectory.ts'

const END = Date.parse('2026-11-10T00:00:00Z')
const H = 3600e3

// A straight path due north along 77°E, ~0.1° (≈11.1 km) per hour.
const path: TrajPoint[] = Array.from({ length: 11 }, (_, h) => ({ lat: 28 + h * 0.1, lon: 77, hoursAgo: h }))

test('km travelled sums the haversine distance of each step', () => {
  assert.ok(Math.abs(pathKm(path) - 111.2) < 0.5, `got ${pathKm(path)}`)
  const cum = cumulativeKm(path)
  assert.equal(cum.length, path.length)
  assert.equal(cum[0], 0)
  for (let i = 1; i < cum.length; i++) assert.ok(cum[i] > cum[i - 1])
})

test('a fire near the path at the right time counts once, at the first hour it qualifies', () => {
  const fires: Fire[] = [{ lat: 28.5, lon: 77.1, t: END - 5 * H, confidence: 'n' }] // ~10 km off, 5 h ago
  const passed = firesPassed(path, fires, END)
  assert.equal(passed.length, 1)
  assert.ok(passed[0].hoursAgo <= 5)
})

test('fires further than 25 km away do not count', () => {
  const fires: Fire[] = [{ lat: 28.5, lon: 77.4, t: END - 5 * H, confidence: 'n' }] // ~39 km east
  assert.equal(firesPassed(path, fires, END).length, 0)
})

test('fires detected outside ±6 h of when the path was there do not count', () => {
  // The path is at 29.0°N 10 hours ago; a fire there detected 30 hours ago is out of the window.
  const stale: Fire[] = [{ lat: 29.0, lon: 77.0, t: END - 30 * H, confidence: 'h' }]
  assert.equal(firesPassed(path, stale, END).length, 0)
  const inWindow: Fire[] = [{ lat: 29.0, lon: 77.0, t: END - 15 * H, confidence: 'h' }]
  assert.equal(firesPassed(path, inWindow, END).length, 1)
})

test('each fire counts once even if many path points are near it', () => {
  const fires: Fire[] = [
    { lat: 28.3, lon: 77.0, t: END - 3 * H, confidence: 'n' },
    { lat: 28.3, lon: 77.0, t: END - 3 * H, confidence: 'n' }, // a second detection at the same spot is a separate fire
  ]
  const passed = firesPassed(path, fires, END)
  assert.equal(passed.length, 2)
  assert.deepEqual(
    passed.map((p) => p.index),
    [0, 1],
  )
})

test('traceStats: hours in transit is the number of steps', () => {
  const s = traceStats(path, [])
  assert.equal(s.hours, 10)
  assert.equal(s.fires, 0)
  assert.equal(s.km, 111)
})
