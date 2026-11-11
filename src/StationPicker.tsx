// Station picker: a sheet with an up-down scroll wheel (like a phone's date picker).
// The row in the centre band is the choice; rows above and below tilt away and fade.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { STATIONS, stationByCode } from './stations'

const ROW = 52 // px per row
const VISIBLE = 5 // rows shown

export function StationSheet({ value, onPick, onClose, confirmLabel = 'Select' }: {
  value: string
  onPick: (code: string) => void
  onClose: () => void
  confirmLabel?: string
}) {
  const [index, setIndex] = useState(() => Math.max(0, STATIONS.findIndex((s) => s.code === value)))
  const [scroll, setScroll] = useState(index * ROW)
  const wheel = useRef<HTMLDivElement>(null)
  const closed = useRef(false)

  const close = (after?: () => void) => {
    if (closed.current) return
    closed.current = true
    after?.()
    onClose()
    if (history.state?.stationSheet) history.back()
  }

  // Start with the current station in the centre.
  useLayoutEffect(() => { if (wheel.current) wheel.current.scrollTop = index * ROW }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // The phone's Back button closes the sheet instead of leaving the app.
  useEffect(() => {
    history.pushState({ stationSheet: true }, '')
    const onPop = () => { if (!closed.current) { closed.current = true; onClose() } }
    window.addEventListener('popstate', onPop)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('popstate', onPop); document.body.style.overflow = '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i: number) => {
    const j = Math.max(0, Math.min(STATIONS.length - 1, i))
    setIndex(j)
    wheel.current?.scrollTo({ top: j * ROW, behavior: 'smooth' })
  }

  const onScroll = () => {
    const top = wheel.current?.scrollTop ?? 0
    setScroll(top)
    setIndex(Math.max(0, Math.min(STATIONS.length - 1, Math.round(top / ROW))))
  }

  const chosen = STATIONS[index]

  return createPortal(
    <div className="sheet-backdrop" onClick={() => close()}>
      <div className="sheet station-sheet" role="dialog" aria-modal="true" aria-label="Choose station" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">Choose station</div>
            <div className="muted">Scroll the wheel, then tap {confirmLabel}</div>
          </div>
          <button className="sheet-x" aria-label="Close" onClick={() => close()}>✕</button>
        </div>
        <div className="wheel-wrap" style={{ height: ROW * VISIBLE }}>
          <div className="wheel-band" style={{ top: ROW * 2, height: ROW }} aria-hidden="true" />
          <div
            ref={wheel}
            className="wheel"
            role="listbox"
            aria-label="Stations"
            aria-activedescendant={`st-${chosen.code}`}
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); goTo(index + 1) }
              if (e.key === 'ArrowUp') { e.preventDefault(); goTo(index - 1) }
              if (e.key === 'Enter') close(() => onPick(chosen.code))
            }}
            style={{ paddingTop: ROW * 2, paddingBottom: ROW * 2 }}
          >
            {STATIONS.map((s, i) => {
              const d = (i * ROW - scroll) / ROW // rows away from the centre
              const a = Math.min(Math.abs(d), 3)
              return (
                <div
                  key={s.code}
                  id={`st-${s.code}`}
                  role="option"
                  aria-selected={i === index}
                  className={'wheel-row' + (i === index ? ' on' : '')}
                  style={{ height: ROW, transform: `rotateX(${Math.max(-60, Math.min(60, -d * 20))}deg) scale(${1 - a * 0.06})`, opacity: 1 - a * 0.28 }}
                  onClick={() => goTo(i)}
                >
                  <span className="wr-name">{s.name}</span>
                  <span className="wr-code">{s.code}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="station-actions">
          <button className="big-btn" onClick={() => close(() => onPick(chosen.code))}>
            {confirmLabel} {chosen.name}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** A form field showing the chosen station; tapping it opens the wheel. */
export function StationField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const s = stationByCode(value)
  return (
    <>
      <div className="field">
        <span>Station</span>
        <button type="button" className="station-field" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <b>{s.name}</b><small>{s.code}</small>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4" /></svg>
        </button>
      </div>
      {open && <StationSheet value={value} onPick={onChange} onClose={() => setOpen(false)} />}
    </>
  )
}
