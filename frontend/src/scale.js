export function distancePixelsBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function pixelsPerMeterFromDistance(pixels, meters) {
  if (!Number.isFinite(pixels) || !Number.isFinite(meters) || meters <= 0 || pixels <= 0) {
    return 0
  }

  return pixels / meters
}

export function pixelsToMeters(pixels, pixelsPerMeter) {
  if (!Number.isFinite(pixels) || !Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) {
    return 0
  }

  return pixels / pixelsPerMeter
}
