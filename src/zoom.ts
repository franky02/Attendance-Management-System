// App-wide zoom for the screen content (the header and tab bar stay put). Remembered on this device.
import { useCallback, useEffect, useState } from 'react'

export const ZOOM_STEPS = [0.9, 1, 1.15, 1.3, 1.45]
const KEY = 'ennore-muster-zoom'

function read(): number {
  try {
    const z = Number(localStorage.getItem(KEY))
    if (ZOOM_STEPS.includes(z)) return z
  } catch { /* ignore */ }
  return 1
}

export function useZoom() {
  const [zoom, setZoom] = useState(read)
  useEffect(() => { try { localStorage.setItem(KEY, String(zoom)) } catch { /* ignore */ } }, [zoom])
  const step = useCallback((dir: 1 | -1) => setZoom((z) => {
    const i = ZOOM_STEPS.indexOf(z)
    return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir))]
  }), [])
  const idx = ZOOM_STEPS.indexOf(zoom)
  return { zoom, zoomIn: () => step(1), zoomOut: () => step(-1), canIn: idx < ZOOM_STEPS.length - 1, canOut: idx > 0 }
}
