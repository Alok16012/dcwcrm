'use client'
import { useMemo } from 'react'

/**
 * The animations a festival greeting can run over its image. Each one is a
 * pointer-events-none layer meant to sit inside a `relative overflow-hidden`
 * box (the dashboard banner, or the preview on the Greetings page).
 *
 * The key is stored as plain text in greeting_banners.effect, so adding one
 * here needs no migration; an unknown key draws nothing.
 */

export const GREETING_EFFECTS = [
  { key: 'petals', label: 'Falling petals', hint: 'Chhath, Navratri, Durga Puja' },
  { key: 'diyas', label: 'Diyas & embers', hint: 'Diwali, Dev Deepawali' },
  { key: 'fireworks', label: 'Fireworks', hint: 'Diwali, New Year' },
  { key: 'colors', label: 'Holi colours', hint: 'Holi' },
  { key: 'moon', label: 'Moon, stars & lanterns', hint: 'Eid, Ramadan, Karwa Chauth' },
  { key: 'kites', label: 'Flying kites', hint: 'Makar Sankranti, Lohri, Pongal' },
  { key: 'tricolour', label: 'Tricolour confetti', hint: 'Independence Day, Republic Day' },
  { key: 'snow', label: 'Snowfall', hint: 'Christmas, winter' },
  { key: 'confetti', label: 'Confetti', hint: 'New Year, results, celebrations' },
  { key: 'balloons', label: 'Balloons', hint: 'Birthdays, anniversaries' },
  { key: 'hearts', label: 'Floating hearts', hint: 'Raksha Bandhan, Bhai Dooj' },
  { key: 'sparkles', label: 'Sparkles', hint: 'Any occasion' },
  { key: 'none', label: 'No effect', hint: '' },
] as const

export type GreetingEffect = (typeof GREETING_EFFECTS)[number]['key']

/** Deterministic "random" in [0, 1) so particles don't jump on re-render. */
const r = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  // Rounded so the server and the browser agree (Math.sin differs in the last digits).
  return Math.round((x - Math.floor(x)) * 1000) / 1000
}

const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length]

export function GreetingEffectLayer({ effect }: { effect: string }) {
  const n = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  if (!effect || effect === 'none') return null

  let body: React.ReactNode = null

  switch (effect) {
    case 'petals':
      body = n.slice(0, 18).map(i => {
        const size = 8 + r(i, 1) * 9
        return (
          <span key={i} className="ge-fall absolute -top-6 rounded-[60%_0_60%_0]" style={{
            left: `${r(i, 2) * 100}%`, width: size, height: size * 0.7,
            background: pick(['#f97316', '#fbbf24', '#f59e0b'], i),
            animationDelay: `${r(i, 3) * 6}s`, animationDuration: `${6 + r(i, 4) * 5}s`,
            ['--drift' as string]: `${(i % 2 ? 1 : -1) * (20 + r(i, 5) * 40)}px`,
          }} />
        )
      })
      break

    case 'sparkles':
      body = n.slice(0, 18).map(i => (
        <span key={i} className="ge-twinkle absolute text-amber-300" style={{
          left: `${r(i, 2) * 100}%`, top: `${r(i, 6) * 90}%`, fontSize: 12 + r(i, 1) * 10,
          animationDelay: `${r(i, 3) * 3.5}s`, animationDuration: `${2 + (i % 3)}s`,
          textShadow: '0 0 8px rgba(251,191,36,0.9)',
        }}>✦</span>
      ))
      break

    case 'diyas':
      body = (
        <>
          {/* Embers drifting up */}
          {n.slice(0, 16).map(i => (
            <span key={`e${i}`} className="ge-rise absolute bottom-6 rounded-full" style={{
              left: `${r(i, 2) * 100}%`, width: 3 + r(i, 1) * 3, height: 3 + r(i, 1) * 3,
              background: pick(['#fde047', '#fb923c', '#fbbf24'], i),
              boxShadow: '0 0 6px 2px rgba(251,146,60,0.8)',
              animationDelay: `${r(i, 3) * 5}s`, animationDuration: `${3.5 + r(i, 4) * 3}s`,
              ['--drift' as string]: `${(r(i, 5) - 0.5) * 50}px`,
            }} />
          ))}
          {/* A row of diyas along the bottom */}
          <div className="absolute inset-x-0 bottom-1 flex justify-around px-4">
            {n.slice(0, 7).map(i => (
              <span key={`d${i}`} className="relative block" style={{ width: 26, height: 22 }}>
                <span className="ge-flame absolute left-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%]" style={{
                  bottom: 9, width: 8, height: 14, marginLeft: -4,
                  background: 'radial-gradient(circle at 50% 70%, #fff7cc 0%, #fde047 35%, #f97316 80%)',
                  boxShadow: '0 0 12px 4px rgba(253,186,116,0.75)',
                  animationDelay: `${r(i, 3) * 0.8}s`,
                }} />
                <span className="absolute inset-x-0 bottom-0 rounded-b-full" style={{
                  height: 11, background: 'linear-gradient(#c2410c, #7c2d12)', boxShadow: 'inset 0 2px 0 #fb923c',
                }} />
              </span>
            ))}
          </div>
        </>
      )
      break

    case 'fireworks':
      body = n.slice(0, 6).map(i => {
        const color = pick(['#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb923c', '#c084fc'], i)
        return (
          <span key={i} className="absolute" style={{ left: `${10 + r(i, 2) * 80}%`, top: `${12 + r(i, 6) * 50}%` }}>
            {Array.from({ length: 12 }, (_, k) => (
              <span key={k} className="ge-burst absolute left-0 top-0 block rounded-full" style={{
                width: 3, height: 10, background: color, boxShadow: `0 0 6px ${color}`,
                ['--a' as string]: `${k * 30}deg`,
                animationDelay: `${i * 0.7 + r(i, 3)}s`,
              }} />
            ))}
          </span>
        )
      })
      break

    case 'colors':
      body = (
        <>
          {/* Clouds of gulal puffing up */}
          {n.slice(0, 9).map(i => (
            <span key={`p${i}`} className="ge-puff absolute rounded-full" style={{
              left: `${r(i, 2) * 90}%`, top: `${r(i, 6) * 80}%`, width: 70 + r(i, 1) * 70, height: 70 + r(i, 1) * 70,
              background: pick(['#ec4899', '#22c55e', '#facc15', '#3b82f6', '#a855f7', '#f97316'], i),
              filter: 'blur(18px)', mixBlendMode: 'multiply',
              animationDelay: `${r(i, 3) * 4}s`, animationDuration: `${3.5 + r(i, 4) * 2}s`,
            }} />
          ))}
          {/* Droplets thrown across */}
          {n.slice(0, 20).map(i => (
            <span key={`s${i}`} className="ge-splash absolute rounded-full" style={{
              left: `${r(i, 7) * 100}%`, bottom: 0, width: 5 + r(i, 1) * 5, height: 5 + r(i, 1) * 5,
              background: pick(['#ec4899', '#22c55e', '#facc15', '#3b82f6', '#a855f7'], i),
              animationDelay: `${r(i, 8) * 4}s`, animationDuration: `${2 + r(i, 9) * 1.5}s`,
              ['--drift' as string]: `${(r(i, 5) - 0.5) * 120}px`,
            }} />
          ))}
        </>
      )
      break

    case 'moon':
      body = (
        <>
          {n.slice(0, 16).map(i => (
            <span key={`s${i}`} className="ge-twinkle absolute" style={{
              left: `${r(i, 2) * 100}%`, top: `${r(i, 6) * 70}%`, fontSize: 8 + r(i, 1) * 8, color: '#fef3c7',
              textShadow: '0 0 6px rgba(254,243,199,0.95)',
              animationDelay: `${r(i, 3) * 3}s`, animationDuration: `${2.5 + (i % 3)}s`,
            }}>★</span>
          ))}
          {/* Crescent */}
          <span className="ge-glow absolute right-[12%] top-4 block rounded-full" style={{
            width: 46, height: 46, boxShadow: '12px 8px 0 0 #fde68a', filter: 'drop-shadow(0 0 10px rgba(253,230,138,0.9))',
          }} />
          {/* Hanging lanterns */}
          {[8, 24, 70].map((left, i) => (
            <span key={`l${i}`} className="ge-swing absolute top-0 flex flex-col items-center" style={{ left: `${left}%`, animationDelay: `${i * 0.6}s` }}>
              <span className="block w-px bg-amber-200/80" style={{ height: 18 + i * 14 }} />
              <span className="block rounded-md" style={{
                width: 16, height: 24, background: 'linear-gradient(#fbbf24, #b45309)',
                boxShadow: '0 0 14px 4px rgba(251,191,36,0.55)', border: '1px solid #78350f',
              }} />
            </span>
          ))}
        </>
      )
      break

    case 'kites':
      body = n.slice(0, 6).map(i => {
        const color = pick(['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6'], i)
        const size = 18 + r(i, 1) * 14
        return (
          <span key={i} className="ge-kite absolute" style={{
            top: `${8 + r(i, 6) * 55}%`, left: '-15%',
            animationDelay: `${i * 1.7}s`, animationDuration: `${10 + r(i, 4) * 6}s`,
          }}>
            <span className="ge-bob block" style={{ animationDelay: `${r(i, 3)}s` }}>
              <span className="block rotate-45" style={{
                width: size, height: size, background: `linear-gradient(135deg, ${color} 50%, #fff7 50%)`,
                border: `1px solid ${color}`, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }} />
              <span className="absolute left-1/2 block w-px origin-top" style={{
                top: size * 1.2, height: 36, background: 'rgba(100,116,139,0.6)', transform: 'rotate(-20deg)',
              }} />
            </span>
          </span>
        )
      })
      break

    case 'tricolour':
    case 'confetti': {
      const colors = effect === 'tricolour'
        ? ['#FF9933', '#ffffff', '#138808']
        : ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
      body = n.map(i => (
        <span key={i} className="ge-confetti absolute -top-4 block" style={{
          left: `${r(i, 2) * 100}%`, width: 6 + r(i, 1) * 5, height: 10 + r(i, 1) * 6,
          background: pick(colors, i), border: effect === 'tricolour' && i % 3 === 1 ? '1px solid #cbd5e1' : undefined,
          borderRadius: i % 4 === 0 ? '50%' : 2,
          animationDelay: `${r(i, 3) * 5}s`, animationDuration: `${4 + r(i, 4) * 3}s`,
          ['--drift' as string]: `${(r(i, 5) - 0.5) * 90}px`,
        }} />
      ))
      break
    }

    case 'snow':
      body = n.map(i => {
        const size = 4 + r(i, 1) * 6
        return (
          <span key={i} className="ge-fall absolute -top-4 rounded-full bg-white" style={{
            left: `${r(i, 2) * 100}%`, width: size, height: size, boxShadow: '0 0 4px rgba(148,163,184,0.9)',
            animationDelay: `${r(i, 3) * 7}s`, animationDuration: `${7 + r(i, 4) * 6}s`,
            ['--drift' as string]: `${(r(i, 5) - 0.5) * 60}px`,
          }} />
        )
      })
      break

    case 'balloons':
      body = n.slice(0, 10).map(i => {
        const color = pick(['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6'], i)
        const w = 22 + r(i, 1) * 12
        return (
          <span key={i} className="ge-rise absolute flex flex-col items-center" style={{
            left: `${r(i, 2) * 92}%`, bottom: -80,
            animationDelay: `${r(i, 3) * 7}s`, animationDuration: `${7 + r(i, 4) * 4}s`,
            ['--drift' as string]: `${(r(i, 5) - 0.5) * 60}px`, ['--rise' as string]: '-560px',
          }}>
            <span className="block rounded-[50%_50%_50%_50%/45%_45%_55%_55%]" style={{
              width: w, height: w * 1.2,
              background: `radial-gradient(circle at 30% 30%, #fff8, transparent 35%), ${color}`,
            }} />
            <span className="block w-px bg-gray-400/70" style={{ height: 30 }} />
          </span>
        )
      })
      break

    case 'hearts':
      body = n.slice(0, 16).map(i => (
        <span key={i} className="ge-rise absolute bottom-0" style={{
          left: `${r(i, 2) * 96}%`, fontSize: 12 + r(i, 1) * 14, color: pick(['#f43f5e', '#ec4899', '#fb7185', '#f59e0b'], i),
          textShadow: '0 1px 4px rgba(244,63,94,0.4)',
          animationDelay: `${r(i, 3) * 6}s`, animationDuration: `${5 + r(i, 4) * 3}s`,
          ['--drift' as string]: `${(r(i, 5) - 0.5) * 70}px`,
        }}>♥</span>
      ))
      break
  }

  if (!body) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {body}
      <style>{EFFECT_CSS}</style>
    </div>
  )
}

const EFFECT_CSS = `
  .ge-fall, .ge-rise, .ge-twinkle, .ge-burst, .ge-puff, .ge-splash, .ge-confetti, .ge-kite {
    opacity: 0; animation-iteration-count: infinite;
  }
  .ge-fall { animation-name: ge-fall; animation-timing-function: linear; }
  @keyframes ge-fall {
    0% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
    10% { opacity: 0.95; } 90% { opacity: 0.85; }
    100% { opacity: 0; transform: translate(var(--drift, 0px), 440px) rotate(540deg); }
  }
  .ge-rise { animation-name: ge-rise; animation-timing-function: ease-out; }
  @keyframes ge-rise {
    0% { opacity: 0; transform: translate(0, 0); }
    15% { opacity: 1; } 80% { opacity: 0.9; }
    100% { opacity: 0; transform: translate(var(--drift, 0px), var(--rise, -260px)); }
  }
  .ge-twinkle { animation-name: ge-twinkle; animation-timing-function: ease-in-out; }
  @keyframes ge-twinkle { 0%, 100% { opacity: 0; transform: scale(0.4); } 50% { opacity: 1; transform: scale(1.1); } }
  .ge-flame { animation: ge-flicker 0.9s ease-in-out infinite alternate; transform-origin: 50% 100%; }
  @keyframes ge-flicker {
    0% { transform: scale(1, 1) rotate(-3deg); opacity: 0.95; }
    50% { transform: scale(0.92, 1.12) rotate(2deg); opacity: 1; }
    100% { transform: scale(1.05, 0.94) rotate(-1deg); opacity: 0.9; }
  }
  .ge-burst { animation: ge-burst 4.2s ease-out infinite; transform-origin: 50% 0; }
  @keyframes ge-burst {
    0% { opacity: 0; transform: rotate(var(--a)) translateY(0) scaleY(0.2); }
    4% { opacity: 1; }
    30% { opacity: 0.9; transform: rotate(var(--a)) translateY(-48px) scaleY(1); }
    45%, 100% { opacity: 0; transform: rotate(var(--a)) translateY(-60px) scaleY(0.4); }
  }
  .ge-puff { animation-name: ge-puff; animation-timing-function: ease-out; }
  @keyframes ge-puff {
    0% { opacity: 0; transform: scale(0.2); }
    30% { opacity: 0.55; }
    100% { opacity: 0; transform: scale(1.6); }
  }
  .ge-splash { animation-name: ge-splash; animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  @keyframes ge-splash {
    0% { opacity: 0; transform: translate(0, 0) scale(0.6); }
    10% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--drift), -300px) scale(1.2); }
  }
  .ge-confetti { animation-name: ge-confetti; animation-timing-function: linear; }
  @keyframes ge-confetti {
    0% { opacity: 0; transform: translate(0, 0) rotateX(0) rotateZ(0); }
    8% { opacity: 1; } 90% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--drift), 440px) rotateX(720deg) rotateZ(360deg); }
  }
  .ge-kite { animation-name: ge-kite; animation-timing-function: ease-in-out; }
  @keyframes ge-kite {
    0% { opacity: 0; transform: translate(0, 0); }
    8% { opacity: 1; } 90% { opacity: 1; }
    100% { opacity: 0; transform: translate(130vw, -40px); }
  }
  .ge-bob { animation: ge-bob 1.8s ease-in-out infinite alternate; }
  @keyframes ge-bob { from { transform: translateY(-6px) rotate(-8deg); } to { transform: translateY(6px) rotate(8deg); } }
  .ge-swing { animation: ge-swing 3s ease-in-out infinite alternate; transform-origin: 50% 0; }
  @keyframes ge-swing { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  .ge-glow { animation: ge-glow 3s ease-in-out infinite alternate; }
  @keyframes ge-glow { from { opacity: 0.8; transform: translateY(0); } to { opacity: 1; transform: translateY(-4px); } }
  @media (prefers-reduced-motion: reduce) {
    .ge-fall, .ge-rise, .ge-twinkle, .ge-burst, .ge-puff, .ge-splash, .ge-confetti, .ge-kite { display: none; }
    .ge-flame, .ge-bob, .ge-swing, .ge-glow { animation: none; }
  }
`
