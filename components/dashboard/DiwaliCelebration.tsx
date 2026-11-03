'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { isFestive, todayIST } from './festival'

/**
 * Diwali greeting on the dashboard: rockets go up and burst into fireworks,
 * with a "Happy Diwali" card on top. Plays automatically once a day per
 * browser during the festival window; the diya button replays it.
 * It never blocks the dashboard — the canvas ignores clicks.
 */

const SHOW_MS = 9000
const STORAGE_KEY = 'dcw-diwali-shown'

const COLORS = ['#ffd166', '#ff6b35', '#ef476f', '#06d6a0', '#4cc9f0', '#f72585', '#ffbe0b', '#fb5607', '#ffffff']


interface Rocket { x: number; y: number; vx: number; vy: number; targetY: number; color: string; trail: { x: number; y: number }[] }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; decay: number; color: string; size: number }

function readSeen(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }  // storage blocked: just play it
}

// Loaded with ssr:false (see dashboard-client), so window/localStorage are safe here
export default function DiwaliCelebration({ name }: { name?: string }) {
  const [today] = useState(todayIST)
  const inWindow = isFestive(today)
  // Plays by itself once a day per browser
  const [playing, setPlaying] = useState(() => inWindow && readSeen() !== today)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!playing) return
    try { localStorage.setItem(STORAGE_KEY, today) } catch { /* ignore */ }
  }, [playing, today])

  const stop = useCallback(() => setPlaying(false), [])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(stop, SHOW_MS)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (reduceMotion || !canvas) return () => clearTimeout(timer)

    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => window.innerWidth
    const H = () => window.innerHeight
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    const rockets: Rocket[] = []
    const sparks: Spark[] = []
    const started = performance.now()
    let lastLaunch = 0
    let raf = 0

    const launch = () => {
      const x = rand(W() * 0.1, W() * 0.9)
      rockets.push({
        x, y: H(), vx: rand(-1, 1), vy: rand(-11, -8.5),
        targetY: rand(H() * 0.12, H() * 0.45), color: pick(COLORS), trail: [],
      })
    }

    const burst = (r: Rocket) => {
      const count = Math.round(rand(55, 90))
      const two = Math.random() < 0.4 ? pick(COLORS) : r.color
      const ring = Math.random() < 0.3
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + rand(-0.05, 0.05)
        const speed = ring ? 5 : rand(1.5, 6.5)
        sparks.push({
          x: r.x, y: r.y,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1, decay: rand(0.011, 0.02),
          color: i % 2 ? r.color : two, size: rand(1.8, 3.2),
        })
      }
    }

    const frame = (now: number) => {
      const elapsed = now - started
      // Fade the previous frame for trails, keeping the canvas transparent
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.fillRect(0, 0, W(), H())
      ctx.globalCompositeOperation = 'lighter'

      // Launch faster at the start, stop launching near the end
      const gap = elapsed < 1500 ? 260 : 520
      if (elapsed < SHOW_MS - 2200 && now - lastLaunch > gap) {
        launch()
        if (Math.random() < 0.35) launch()
        lastLaunch = now
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.trail.push({ x: r.x, y: r.y })
        if (r.trail.length > 10) r.trail.shift()
        r.x += r.vx
        r.y += r.vy
        r.vy += 0.12
        ctx.strokeStyle = r.color
        ctx.lineWidth = 2
        ctx.beginPath()
        r.trail.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.stroke()
        if (r.y <= r.targetY || r.vy >= -1) {
          burst(r)
          rockets.splice(i, 1)
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.98
        s.vy = s.vy * 0.98 + 0.06
        s.life -= s.decay
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        ctx.globalAlpha = s.life
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, W(), H())
    }
  }, [playing, stop])

  if (!inWindow) return null

  const firstName = (name ?? '').trim().split(/\s+/)[0]

  return (
    <>
      {playing && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          {/* Night sky so the fireworks show up on the light dashboard */}
          <div className="diwali-sky absolute inset-0 bg-gradient-to-b from-slate-950/90 via-indigo-950/85 to-slate-950/80" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute inset-x-0 top-[22%] flex justify-center px-4">
            <div className="diwali-card pointer-events-auto relative max-w-sm w-full rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 px-6 py-5 text-center shadow-2xl shadow-orange-500/20">
              <button onClick={stop} aria-label="Close"
                className="absolute right-3 top-3 rounded-full p-1 text-amber-700/60 hover:bg-amber-100 hover:text-amber-800">
                <X className="w-4 h-4" />
              </button>
              <div className="text-4xl leading-none">🪔✨🪔</div>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.25em] text-orange-600">Shubh Deepavali</p>
              <h2 className="mt-1 text-2xl font-extrabold text-gray-900">
                Happy Diwali{firstName ? `, ${firstName}` : ''}!
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Roshni, khushiyan aur dher saare admissions — Team Distance Courses Wala ki taraf se shubhkamnayein 🎆
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Replay — a small diya in the corner for the festival days */}
      {!playing && (
        <button onClick={() => setPlaying(true)} title="Diwali fireworks 🎆"
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-100 to-orange-200 text-2xl shadow-lg shadow-orange-400/30 transition-transform hover:scale-110 animate-[diwali-glow_2.4s_ease-in-out_infinite]">
          🪔
        </button>
      )}

      <style>{`
        .diwali-card { animation: diwali-pop 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
        .diwali-sky { animation: diwali-sky ${SHOW_MS}ms ease-in-out both; }
        @keyframes diwali-sky { 0% { opacity: 0; } 8% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes diwali-pop { from { opacity: 0; transform: translateY(16px) scale(0.92); } to { opacity: 1; transform: none; } }
        @keyframes diwali-glow { 0%, 100% { box-shadow: 0 0 10px 2px rgba(251, 146, 60, 0.35); } 50% { box-shadow: 0 0 22px 6px rgba(251, 191, 36, 0.55); } }
        @media (prefers-reduced-motion: reduce) {
          .diwali-card, .diwali-sky { animation: none; }
          .diwali-sky { opacity: 0.6; }
        }
      `}</style>
    </>
  )
}
