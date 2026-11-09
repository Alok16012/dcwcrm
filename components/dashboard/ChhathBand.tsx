import { Marigold, Strand, WomanSoop } from './ChhathTheme'

/**
 * Desktop Chhath dressing: a sunrise band across the top of the page — the
 * sun coming up over the river, birds crossing the sky, a woman holding the
 * soop to the sun, devotees standing in the water, "Happy Chhath Puja" in
 * script — with marigold garlands floating in both top corners and, along
 * the bottom, the ghat with a fruit basket and a lit diya.
 *
 * `behind` lays the band under the page's own heading and tabs (the staff
 * dashboard); otherwise it is a strip of its own. Everything is
 * pointer-events-none. Animations live in ChhathBandStyles.
 */

/** Marigolds massed in a top corner, with strands hanging down the side. */
function CornerGarland({ side }: { side: 'left' | 'right' }) {
  const swag = Array.from({ length: 14 }, (_, k) => {
    const t = k / 13
    return { x: 10 + t * 300, y: 12 + Math.sin(t * Math.PI) * 22 }
  })
  return (
    <div className={`chb-float absolute top-0 ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'}`}>
      <svg viewBox="0 0 330 70" className="w-[230px] lg:w-[300px] h-auto" aria-hidden>
        <path d={`M ${swag.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke="#92400e" strokeWidth="1.2" fill="none" opacity="0.4" />
        {swag.slice(0, -1).map((p, k) => (
          <path key={`l${k}`} d={`M${(p.x + swag[k + 1].x) / 2} ${(p.y + swag[k + 1].y) / 2 + 4} q ${k % 2 ? 6 : -6} 12 0 24 q ${k % 2 ? -4 : 4} -12 0 -24`} fill={k % 2 ? '#15803d' : '#166534'} />
        ))}
        {swag.map((p, k) => <Marigold key={k} cx={p.x} cy={p.y} r={11} i={k} />)}
        {/* the dense cluster at the corner */}
        {[[8, 8], [24, 6], [10, 26], [26, 22]].map(([x, y], k) => <Marigold key={`c${k}`} cx={x} cy={y} r={12} i={k + 3} />)}
      </svg>
      <Strand count={5} className="absolute left-[2px] top-[18px] h-[96px] w-auto" />
      <Strand count={3} className="absolute left-[30px] top-[24px] h-[60px] w-auto" />
    </div>
  )
}

/** A bird, two wings flapping. */
function Bird({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 16" className={className} style={style} aria-hidden>
      <g className="chb-flap" style={{ transformOrigin: '20px 10px' }}>
        <path d="M2 6 Q 11 0 20 10 Q 29 0 38 6" stroke="#44403c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/** Two devotees far out, standing waist-deep, hands raised to the sun. */
function Devotees({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 60 50" className={className} aria-hidden>
      {[{ x: 18, c: '#7f1d1d' }, { x: 40, c: '#92400e' }].map(({ x, c }) => (
        <g key={x}>
          <circle cx={x} cy={10} r={4} fill="#3f2a1d" />
          <path d={`M ${x - 5} 16 Q ${x} 13 ${x + 5} 16 L ${x + 6} 44 L ${x - 6} 44 Z`} fill={c} />
          <path d={`M ${x - 4} 18 L ${x - 7} 6 M ${x + 4} 18 L ${x + 7} 6`} stroke="#3f2a1d" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  )
}

/** The soop of fruits on the ground, and a lit clay diya beside it. */
function BasketAndDiya() {
  return (
    <svg viewBox="0 0 260 120" className="w-[200px] lg:w-[240px] h-auto" aria-hidden>
      <defs>
        <radialGradient id="chb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* basket */}
      <path d="M 10 70 Q 75 40 140 70 Q 132 112 75 114 Q 18 112 10 70 Z" fill="#c8913c" />
      {Array.from({ length: 9 }, (_, k) => (
        <path key={k} d={`M ${22 + k * 13} 64 L ${24 + k * 12} 110`} stroke="#92621f" strokeWidth="1.2" opacity="0.6" />
      ))}
      {[0, 1, 2].map(k => <path key={`w${k}`} d={`M 14 ${78 + k * 12} Q 75 ${66 + k * 12} 136 ${78 + k * 12}`} stroke="#92621f" strokeWidth="1.2" fill="none" opacity="0.5" />)}
      <path d="M 10 70 Q 75 40 140 70" stroke="#92621f" strokeWidth="3" fill="none" />
      {/* fruits */}
      <path d="M 30 62 q 18 -34 50 -16" stroke="#facc15" strokeWidth="11" fill="none" strokeLinecap="round" />
      <path d="M 36 66 q 18 -30 46 -14" stroke="#eab308" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx="92" cy="52" r="13" fill="#f97316" />
      <circle cx="112" cy="60" r="11" fill="#dc2626" />
      <circle cx="70" cy="48" r="11" fill="#78350f" />
      <path d="M 66 38 q 4 -10 10 -4" stroke="#4d7c0f" strokeWidth="3" fill="none" />
      <path d="M 104 46 l 6 -26 M 112 48 l 10 -24" stroke="#4d7c0f" strokeWidth="4" strokeLinecap="round" />
      <path d="M 120 24 q 14 -6 18 6 M 108 22 q -10 -10 -18 0" stroke="#65a30d" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* diya */}
      <circle cx="205" cy="74" r="34" fill="url(#chb-glow)" className="chb-glow" />
      <path d="M 176 92 Q 205 120 234 92 Q 220 86 205 86 Q 190 86 176 92 Z" fill="#c2410c" />
      <path d="M 176 92 Q 205 100 234 92" stroke="#7c2d12" strokeWidth="2" fill="none" />
      <g className="chb-flame" style={{ transformOrigin: '205px 86px' }}>
        <path d="M 205 56 Q 216 74 205 86 Q 194 74 205 56 Z" fill="#fbbf24" />
        <path d="M 205 66 Q 211 77 205 84 Q 199 77 205 66 Z" fill="#fff7d6" />
      </g>
    </svg>
  )
}

/** The band: sky, sun, river, birds, the woman, devotees and the greeting. */
export function ChhathBand({ behind = false, id = 'band' }: { behind?: boolean; id?: string }) {
  // Where things sit: under the page heading, the woman stands clear of it.
  const womanLeft = behind ? 'left-[34%]' : 'left-[7%]'
  return (
    <div aria-hidden className={`chb-in pointer-events-none select-none overflow-hidden ${behind ? 'absolute inset-x-0 top-0 -z-10 h-[232px]' : 'relative h-[210px] rounded-b-3xl'}`}>
      <svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`chb-sky-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="55%" stopColor="#fed7aa" />
            <stop offset="78%" stopColor="#fdba74" />
          </linearGradient>
          <radialGradient id={`chb-sun-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="55%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#fb923c" />
          </radialGradient>
          <radialGradient id={`chb-halo-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`chb-water-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd9b6" />
            <stop offset="45%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id={`chb-fade-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffaf3" stopOpacity="0" />
            <stop offset="100%" stopColor="#fffaf3" stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect width="1200" height="240" fill={`url(#chb-sky-${id})`} />
        {/* sun rising over the horizon */}
        <g className="chb-rise">
          <circle cx="640" cy="170" r="120" fill={`url(#chb-halo-${id})`} className="chb-pulse" />
          <circle cx="640" cy="170" r="44" fill={`url(#chb-sun-${id})`} />
        </g>
        {/* far bank */}
        <path d="M 0 176 Q 120 166 240 174 T 480 172 T 760 176 T 1000 170 T 1200 174 V 186 H 0 Z" fill="#d6a78a" opacity="0.55" />
        {/* river */}
        <rect y="182" width="1200" height="58" fill={`url(#chb-water-${id})`} />
        {[0, 1, 2, 3, 4].map(i => (
          <ellipse key={i} className="chb-glint" cx="640" cy={190 + i * 9} rx={60 - i * 10} ry="2.2" fill="#fff7d6"
            style={{ animationDelay: `${i * 0.3}s` }} />
        ))}
        <g className="chb-wave">
          <path d={wave(200, 6)} fill="#ffffff" opacity="0.35" />
        </g>
        <g className="chb-wave chb-wave-slow">
          <path d={wave(214, 5)} fill="#38bdf8" opacity="0.25" />
        </g>
        {behind && <rect y="200" width="1200" height="40" fill={`url(#chb-fade-${id})`} />}
      </svg>

      {/* birds crossing the sky */}
      {[{ top: 22, d: 0, w: 26 }, { top: 40, d: 2.5, w: 20 }, { top: 30, d: 5, w: 22 }, { top: 54, d: 9, w: 16 }].map((b, i) => (
        <Bird key={i} className="chb-bird absolute" style={{ top: b.top, width: b.w, animationDelay: `-${b.d * 3}s`, animationDuration: `${34 + i * 5}s` }} />
      ))}

      {/* the woman with the soop, and devotees out in the water */}
      <WomanSoop className={`chb-woman absolute bottom-0 ${womanLeft} w-[150px] lg:w-[175px] h-auto -scale-x-100`} />
      <Devotees className="absolute bottom-[34px] right-[11%] w-[46px] h-auto opacity-80" />

      {/* greeting */}
      <div className={`absolute top-[46px] ${behind ? 'right-[18%]' : 'right-[14%]'} text-center`}>
        <svg viewBox="0 0 80 30" className="mx-auto w-[60px] h-auto" aria-hidden>
          <g className="chb-spin-slow" style={{ transformOrigin: '40px 30px' }}>
            {Array.from({ length: 9 }, (_, k) => (
              <path key={k} d="M40 30 L 38 10 L 42 10 Z" fill="#dc2626" transform={`rotate(${-80 + k * 20} 40 30)`} />
            ))}
          </g>
          <circle cx="40" cy="30" r="10" fill="#ea580c" />
        </svg>
        <p className="-mt-1 font-serif italic font-bold text-[34px] lg:text-[40px] leading-none text-[#1e3a8a] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">Happy</p>
        <p className="font-serif italic font-extrabold text-[44px] lg:text-[54px] leading-[1.05] text-[#b91c1c] drop-shadow-[0_2px_0_rgba(255,255,255,0.7)]">
          Chhath Puja
        </p>
        <svg viewBox="0 0 200 12" className="mx-auto mt-1 w-[180px] h-auto" aria-hidden>
          <path d="M 0 6 H 88 M 112 6 H 200" stroke="#b91c1c" strokeWidth="1.5" />
          <path d="M 100 0 L 106 6 L 100 12 L 94 6 Z" fill="#b91c1c" />
          <circle cx="86" cy="6" r="2" fill="#b91c1c" /><circle cx="114" cy="6" r="2" fill="#b91c1c" />
        </svg>
      </div>

      <CornerGarland side="left" />
      <CornerGarland side="right" />
    </div>
  )
}

/** The ghat along the bottom of the page: sand ripples, fruit basket, diya. */
export function ChhathGhat() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[150px] overflow-hidden">
      <svg viewBox="0 0 1200 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M 0 80 Q 200 50 420 78 T 820 70 T 1200 74 V 150 H 0 Z" fill="#fde7c7" />
        <path d="M 0 104 Q 260 82 520 104 T 1000 98 T 1200 102 V 150 H 0 Z" fill="#fbd6a4" opacity="0.8" />
        <path d="M 0 126 Q 300 112 600 128 T 1200 124 V 150 H 0 Z" fill="#f8c98a" opacity="0.7" />
      </svg>
      <div className="absolute bottom-2 left-6"><BasketAndDiya /></div>
    </div>
  )
}

function wave(y: number, amp: number) {
  let d = `M 0 ${y}`
  for (let x = 0; x <= 2400; x += 80) d += ` Q ${x + 40} ${y - amp} ${x + 80} ${y}`
  return `${d} V 240 H 0 Z`
}

export function ChhathBandStyles() {
  return (
    <style>{`
      .chb-in { animation: chb-in 1.4s ease-out both; }
      @keyframes chb-in { from { opacity: 0; } to { opacity: 1; } }
      .chb-rise { animation: chb-rise 7s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
      @keyframes chb-rise { from { transform: translateY(70px); } to { transform: none; } }
      .chb-pulse { animation: chb-pulse 4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes chb-pulse { 0%, 100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
      .chb-glint { animation: chb-glint 2.6s ease-in-out infinite; }
      @keyframes chb-glint { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.95; } }
      .chb-wave { animation: chb-wave 9s linear infinite; }
      .chb-wave-slow { animation-duration: 15s; animation-direction: reverse; }
      @keyframes chb-wave { from { transform: translateX(0); } to { transform: translateX(-160px); } }
      .chb-bird { left: -40px; animation-name: chb-fly; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes chb-fly { from { transform: translateX(0); } to { transform: translateX(calc(100vw + 80px)); } }
      .chb-flap { animation: chb-flap 0.9s ease-in-out infinite; }
      @keyframes chb-flap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.45); } }
      .chb-float { animation: chb-float 5s ease-in-out infinite; }
      @keyframes chb-float { 0%, 100% { translate: 0 0; rotate: 0deg; } 50% { translate: 0 3px; rotate: 0.6deg; } }
      .chb-flame { animation: chb-flame 1.3s ease-in-out infinite; }
      @keyframes chb-flame {
        0%, 100% { transform: scale(1, 1) rotate(-2deg); }
        25% { transform: scale(0.94, 1.08) rotate(2deg); }
        50% { transform: scale(1.05, 0.93) rotate(-1deg); }
        75% { transform: scale(0.97, 1.05) rotate(1.5deg); }
      }
      .chb-glow { animation: chb-glowp 1.9s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes chb-glowp { 0%, 100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
      .chb-woman { animation: chb-woman 1.6s 0.4s cubic-bezier(0.2, 1, 0.4, 1) both; }
      @keyframes chb-woman { from { opacity: 0; translate: 0 24px; } to { opacity: 1; translate: 0 0; } }
      .chb-spin-slow { animation: chb-spin 30s linear infinite; }
      @keyframes chb-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .chb-in, .chb-rise, .chb-pulse, .chb-glint, .chb-wave, .chb-bird, .chb-flap, .chb-float, .chb-flame, .chb-glow, .chb-woman, .chb-spin-slow { animation: none; }
        .chb-bird { display: none; }
      }
    `}</style>
  )
}
