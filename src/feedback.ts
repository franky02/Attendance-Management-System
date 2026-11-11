// Sound and vibration feedback. Sounds are synthesised with the Web Audio API (no audio files), and
// vibration uses navigator.vibrate (Android; iPhones simply ignore it). Both can be switched off on
// the Staff tab, and the choice is remembered on the phone.
//
// Kinds:
//   tap     every ordinary button: a soft click and a tiny pulse
//   tick    one step of a selecting scroller (station wheel), a tab, or a month: lighter still
//   success a bigger action finished (Mark remaining Present, a PDF downloaded)
//   warn    something needs attention (a save failed, sign-in failed)
import { useSyncExternalStore } from 'react'

export type Kind = 'tap' | 'tick' | 'success' | 'warn'
interface Settings { sound: boolean; haptics: boolean }

const KEY = 'ennore-muster-feedback'
let settings: Settings = (() => {
  try { return { sound: true, haptics: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { sound: true, haptics: true } }
})()
const listeners = new Set<() => void>()

export function setFeedback(patch: Partial<Settings>) {
  settings = { ...settings, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function useFeedbackSettings(): Settings {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => settings)
}

const VIBES: Record<Kind, number | number[]> = { tap: 8, tick: 4, success: [10, 45, 16], warn: [28, 60, 28] }

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

/** One short tone: frequency glide, quick attack, exponential fade. */
function tone(a: AudioContext, at: number, f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, at)
  o.frequency.exponentialRampToValueAtTime(f1, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(a.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

function sound(kind: Kind) {
  const a = audio()
  if (!a) return
  const t = a.currentTime + 0.001
  if (kind === 'tap') tone(a, t, 1400, 700, 0.03, 0.05, 'triangle')
  else if (kind === 'tick') tone(a, t, 2400, 1900, 0.014, 0.03)
  else if (kind === 'success') { tone(a, t, 660, 660, 0.08, 0.05, 'triangle'); tone(a, t + 0.08, 990, 990, 0.12, 0.05, 'triangle') }
  else { tone(a, t, 240, 200, 0.12, 0.05, 'square'); tone(a, t + 0.16, 240, 200, 0.12, 0.05, 'square') }
}

let last = 0
/** Play feedback. Ticks closer than 35 ms apart are merged so fast scrolling never buzzes. */
export function feedback(kind: Kind = 'tap') {
  if (document.visibilityState !== 'visible') return
  const now = performance.now()
  if (kind === 'tick' && now - last < 35) return
  last = now
  if (settings.haptics && 'vibrate' in navigator) { try { navigator.vibrate(VIBES[kind]) } catch { /* ignore */ } }
  if (settings.sound) sound(kind)
}

/**
 * Every button gives feedback when pressed, without touching each one: a single listener on the page.
 * A button can choose its kind with data-fb="tick" | "success" | "warn", or opt out with data-fb="off"
 * (used where the screen plays its own, more specific feedback).
 */
export function installButtonFeedback() {
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button')
    if (!b || b.disabled) return
    const k = b.dataset.fb
    if (k === 'off') return
    feedback((k as Kind) || 'tap')
  }, { capture: true })
}
