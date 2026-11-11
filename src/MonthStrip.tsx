import { useEffect, useRef } from 'react'
import { monthChip } from './dates'

/** Sideways-scrolling strip of months; the chosen one is kept in view. */
export function MonthStrip({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  useEffect(() => {
    const strip = ref.current
    const el = strip?.querySelector<HTMLElement>(`[data-month="${value}"]`)
    if (!strip || !el) return
    // Centre the chosen month: instantly when the tab opens, smoothly after a tap.
    const target = Math.max(0, Math.min(el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2, strip.scrollWidth - strip.clientWidth))
    if (first.current) { strip.scrollLeft = target; first.current = false; return }
    // Own short animation: the browser's smooth scroll gets cut off when the list below redraws.
    const from = strip.scrollLeft
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 260)
      strip.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    // Land exactly on the month even if no frames were drawn (e.g. the app was in the background).
    const done = setTimeout(() => { strip.scrollLeft = target }, 300)
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [value])
  return (
    <div className="month-strip" ref={ref} role="radiogroup" aria-label="Month">
      {months.map((m) => {
        const [mon, yr] = monthChip(m)
        return (
          <button key={m} data-month={m} role="radio" aria-checked={m === value} className={'month-chip' + (m === value ? ' on' : '')} onClick={() => onChange(m)}>
            <b>{mon}</b><small>{yr}</small>
          </button>
        )
      })}
    </div>
  )
}
