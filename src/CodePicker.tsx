// A list that slides up from the bottom for choosing a code (leave types, or any code from the grid).
// The phone's Back button closes it instead of leaving the app.
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { StatusCode } from './statusCodes'

interface Props {
  title: string
  subtitle?: string
  options: StatusCode[]
  current: string | undefined
  onPick: (code: string | null) => void
  onClose: () => void
}

export function CodePicker({ title, subtitle, options, current, onPick, onClose }: Props) {
  const closed = useRef(false)
  const close = (after?: () => void) => {
    if (closed.current) return
    closed.current = true
    after?.()
    onClose()
    if (history.state?.picker) history.back()
  }

  useEffect(() => {
    history.pushState({ picker: true }, '')
    const onPop = () => { if (!closed.current) { closed.current = true; onClose() } }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drawn on the page itself (outside the zoomed screen area) so it always fits; it applies the zoom on its own.
  return createPortal(
    <div className="sheet-backdrop" onClick={() => close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">{title}</div>
            {subtitle && <div className="muted">{subtitle}</div>}
          </div>
          <button className="sheet-x" aria-label="Close" onClick={() => close()}>✕</button>
        </div>
        <div className="sheet-list">
          {options.map((o) => (
            <button
              key={o.code}
              className={'sheet-opt' + (o.code === current ? ' on' : '')}
              style={{ '--c': o.color } as React.CSSProperties}
              onClick={() => close(() => onPick(o.code))}
            >
              <span className="opt-code">{o.code}</span>
              <span className="opt-label">{o.label}</span>
              <span className="opt-radio" aria-hidden="true" />
            </button>
          ))}
          {current && (
            <button className="sheet-opt clear" onClick={() => close(() => onPick(null))}>
              <span className="opt-code">—</span>
              <span className="opt-label">Clear (leave blank)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  , document.body)
}
