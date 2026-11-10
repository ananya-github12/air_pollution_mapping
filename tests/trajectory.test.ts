import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backStep, backTrajectory, gridFromRaw, toUV, windAt, type RawWindGrid } from '../src/lib/trajectory.ts'
import { haversineKm } from '../src/lib/distance.ts'

/** A uniform wind grid over north India for testing. */
function uniformGrid(speed: number, dir: number, hours = 49): RawWindGrid {
  const nx = 14
  const ny = 11
  const n = nx * ny * hours
  return { west: 72, south: 23, step: 1, nx, ny, start: '2026-11-08T00:00:00Z', hours, speed: Array(n).fill(speed), dir: Array(n).fill(dir) }
}

test('wind FROM the north pushes air south, so one back-step moves the point north', () => {
  const { u, v } = toUV(10, 0)
  const p = backStep(28.6, 77.2, u, v)
  assert.ok(p.lat > 28.6, 'moved north')
  assert.ok(Math.abs(p.lon - 77.2) < 1e-9, 'no east-west movement')
})

test('wind FROM the west: back-step moves the point west', () => {
  const { u, v } = toUV(10, 270)
  const p = backStep(28.6, 77.2, u, v)
  assert.ok(p.lon < 77.2, 'moved west')
  assert.ok(Math.abs(p.lat - 28.6) < 1e-9)
})

test('wind FROM the north-west: back-step moves the point north-west', () => {
  const { u, v } = toUV(5, 315)
  const p = backStep(28.6, 77.2, u, v)
  assert.ok(p.lat > 28.6 && p.lon < 77.2)
})

test('one step covers speed × 3600 s', () => {
  for (const dir of [0, 90, 200, 315]) {
    const { u, v } = toUV(10, dir)
    const p = backStep(28.6, 77.2, u, v)
    const km = haversineKm(28.6, 77.2, p.lat, p.lon)
    assert.ok(Math.abs(km - 36) < 0.3, `dir ${dir}: expected ~36 km, got ${km.toFixed(2)}`)
  }
})

test('interpolating u/v (not raw degrees) handles the 0°/360° wrap', () => {
  // Half the grid has wind from 350°, half from 10°: the blend must be ~from 0°, not ~from 180°.
  const raw = uniformGrid(5, 350, 1)
  for (let k = 0; k < raw.dir.length; k++) if (k % raw.nx >= 7) raw.dir[k] = 10
  const g = gridFromRaw(raw)
  const w = windAt(g, 28, 78.5, 0)!
  assert.ok(w.v < 0, 'still blowing toward the south')
})

test('trajectory runs 48 hourly steps in a gentle wind and returns hoursAgo 0..48', () => {
  const g = gridFromRaw(uniformGrid(2.5, 315))
  const path = backTrajectory(g, 28.6, 77.2)
  assert.equal(path.length, 49)
  assert.deepEqual(
    path.map((p) => p.hoursAgo),
    Array.from({ length: 49 }, (_, i) => i),
  )
})

test('trajectory stops early when it leaves the grid', () => {
  const g = gridFromRaw(uniformGrid(15, 270)) // fast wind from the west: runs off the western edge
  const path = backTrajectory(g, 28.6, 77.2)
  assert.ok(path.length < 49, `stopped after ${path.length - 1} steps`)
  for (const p of path) assert.ok(p.lon >= 72, 'every point is inside the grid')
})
