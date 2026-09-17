import test from 'node:test'
import assert from 'node:assert/strict'
import { distancePixelsBetween, pixelsPerMeterFromDistance, pixelsToMeters } from './scale.js'

test('distancePixelsBetween returns Euclidean distance in pixels', () => {
  assert.equal(distancePixelsBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
})

test('pixelsPerMeterFromDistance converts a measured segment into px/m', () => {
  assert.equal(pixelsPerMeterFromDistance(200, 10), 20)
})

test('pixelsToMeters converts a pixel distance into real-world meters', () => {
  assert.equal(pixelsToMeters(150, 20), 7.5)
})
