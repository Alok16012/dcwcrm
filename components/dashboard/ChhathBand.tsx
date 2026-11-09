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

const CHM_COLORS = ['#f97316', '#fbbf24', '#ea580c', '#f59e0b']
const CHM_SWAG = Array.from({ length: 11 }, (_, k) => ({ x: 8 + k * 15, y: 9 + Math.sin((k / 10) * Math.PI) * 12 }))

/** A phone-sized corner garland: a swag along the top, strands down the side. */
function MobileCorner({ flip }: { flip?: boolean }) {
  const C = CHM_COLORS, swag = CHM_SWAG
  return (
    <div className={`chm-float absolute top-0 ${flip ? 'right-0 -scale-x-100' : 'left-0'}`} style={flip ? { animationDelay: '-2.5s' } : undefined}>
      <svg viewBox="0 0 170 120" className="w-[150px] h-auto">
        <path d={`M ${swag.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke="#92400e" strokeWidth="1" fill="none" opacity="0.4" />
        {swag.slice(0, -1).map((p, k) => (
          <path key={`l${k}`} d={`M${p.x + 7} ${p.y + 4} q ${k % 2 ? 4 : -4} 8 0 16 q ${k % 2 ? -3 : 3} -8 0 -16`} fill={k % 2 ? '#15803d' : '#166534'} />
        ))}
        {swag.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r="7" fill={C[k % 4]} />)}
        {[{ x: 7, n: 7 }, { x: 22, n: 4 }].map(({ x, n }) => (
          <g key={x}>
            {Array.from({ length: n }, (_, k) => <circle key={k} cx={x} cy={22 + k * 12} r="6" fill={C[(k + x) % 4]} />)}
            <path d={`M ${x - 4} ${22 + n * 12} q 4 -8 8 0 l 1 4 h -10 z`} fill="#d4a017" />
          </g>
        ))}
      </svg>
    </div>
  )
}

/**
 * The phone version of the band: the same sunrise, draping garlands, birds,
 * river, the woman with the soop, devotees and the script greeting — drawn
 * light (one circle per marigold) and moved only by transform/opacity on
 * HTML layers, so the GPU animates it and slow phones stay smooth.
 */
export function ChhathBandMobile() {
  return (
    <div aria-hidden className="chm-in pointer-events-none select-none relative h-[190px] overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #fff7ed 0%, #fed7aa 60%, #fdba74 76%)' }}>
      {/* sun with turning rays (the wrapper rotates, on the GPU) */}
      <div className="chm-rise absolute left-[40%] top-[78px] -ml-[55px] h-[110px] w-[110px]">
        <div className="chm-spin absolute inset-0">
          <svg viewBox="0 0 110 110" className="h-full w-full">
            {Array.from({ length: 14 }, (_, i) => (
              <rect key={i} x="53" y="2" width="4" height="16" rx="2" fill="#f59e0b" opacity="0.45" transform={`rotate(${i * (360 / 14)} 55 55)`} />
            ))}
          </svg>
        </div>
        <div className="absolute inset-[24px] rounded-full"
          style={{ background: 'radial-gradient(circle at 45% 40%, #fffbeb 0%, #fde68a 50%, #fb923c 100%)', boxShadow: '0 0 36px 14px rgba(254,243,199,0.85)' }} />
      </div>
      {/* birds */}
      {[{ t: 30, d: 0, w: 18 }, { t: 46, d: -8, w: 13 }, { t: 24, d: -15, w: 15 }].map((b, i) => (
        <svg key={i} viewBox="0 0 40 16" className="chm-bird absolute left-0" style={{ top: b.t, width: b.w, animationDelay: `${b.d}s`, animationDuration: `${24 + i * 4}s` }}>
          <path d="M2 6 Q 11 0 20 10 Q 29 0 38 6" stroke="#44403c" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </svg>
      ))}
      {/* far bank and river */}
      <div className="absolute inset-x-0 bottom-[46px] h-[8px] bg-[#d6a78a]/50" style={{ borderRadius: '50% 50% 0 0 / 100% 100% 0 0' }} />
      <div className="absolute inset-x-0 bottom-0 h-[48px]" style={{ background: 'linear-gradient(180deg, #fcd9b6 0%, #bae6fd 40%, #7dd3fc 100%)' }} />
      <div className="chm-wave absolute bottom-[10px] left-0 h-[16px] w-[200%]">
        <svg viewBox="0 0 800 16" preserveAspectRatio="none" className="h-full w-full">
          <path d="M0 8 Q 25 0 50 8 T 100 8 T 150 8 T 200 8 T 250 8 T 300 8 T 350 8 T 400 8 T 450 8 T 500 8 T 550 8 T 600 8 T 650 8 T 700 8 T 750 8 T 800 8 V 16 H 0 Z" fill="#ffffff" opacity="0.45" />
        </svg>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="chm-glint absolute left-[40%] h-[3px] rounded-full bg-amber-100" style={{ bottom: 30 - i * 8, width: 56 - i * 14, marginLeft: -(56 - i * 14) / 2, animationDelay: `${i * 0.3}s` }} />
      ))}
      {/* the woman with the soop, devotees, diyas */}
      <WomanSoop className="absolute bottom-0 left-[1%] w-[96px] h-auto -scale-x-100" />
      <Devotees className="absolute bottom-[26px] right-[6%] w-[30px] h-auto opacity-80" />
      {[52, 70].map((left, i) => (
        <span key={left} className="chm-bob absolute text-sm" style={{ left: `${left}%`, bottom: 8 + i * 6, animationDelay: `${i * 0.9}s`, textShadow: '0 0 8px rgba(253,186,116,0.95)' }}>🪔</span>
      ))}
      {/* greeting */}
      <div className="absolute right-[4%] top-[50px] text-center">
        <svg viewBox="0 0 80 30" className="mx-auto w-[38px] h-auto">
          {Array.from({ length: 9 }, (_, k) => (
            <path key={k} d="M40 30 L 38 10 L 42 10 Z" fill="#dc2626" transform={`rotate(${-80 + k * 20} 40 30)`} />
          ))}
          <circle cx="40" cy="30" r="10" fill="#ea580c" />
        </svg>
        <p className="font-serif italic font-bold text-[21px] leading-none text-[#1e3a8a] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">Happy</p>
        <p className="font-serif italic font-extrabold text-[26px] leading-tight text-[#b91c1c] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">Chhath Puja</p>
        <svg viewBox="0 0 200 12" className="mx-auto w-[110px] h-auto">
          <path d="M 0 6 H 88 M 112 6 H 200" stroke="#b91c1c" strokeWidth="2" />
          <path d="M 100 0 L 106 6 L 100 12 L 94 6 Z" fill="#b91c1c" />
        </svg>
      </div>
      <MobileCorner />
      <MobileCorner flip />
      <style>{`
        .chm-in { animation: chm-in 1s ease-out both; }
        @keyframes chm-in { from { opacity: 0; } to { opacity: 1; } }
        .chm-rise { animation: chm-rise 5s cubic-bezier(0.2, 0.7, 0.3, 1) both; will-change: transform; }
        @keyframes chm-rise { from { transform: translateY(50px); } to { transform: translateY(-34px); } }
        .chm-spin { animation: chm-spin 40s linear infinite; will-change: transform; }
        @keyframes chm-spin { to { transform: rotate(360deg); } }
        .chm-wave { animation: chm-wave 10s linear infinite; will-change: transform; }
        @keyframes chm-wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .chm-bird { animation: chm-fly 24s linear infinite; will-change: transform; }
        @keyframes chm-fly { from { transform: translateX(-30px); } to { transform: translateX(110vw); } }
        .chm-float { animation: chm-float 5s ease-in-out infinite; will-change: transform; }
        @keyframes chm-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 2px; } }
        .chm-bob { animation: chm-bob 3.2s ease-in-out infinite; will-change: transform; }
        @keyframes chm-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-4px) rotate(3deg); } }
        .chm-glint { animation: chm-glint 2.6s ease-in-out infinite; }
        @keyframes chm-glint { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .chm-in, .chm-rise, .chm-spin, .chm-wave, .chm-bird, .chm-float, .chm-bob, .chm-glint { animation: none; }
          .chm-rise { transform: translateY(-34px); }
        }
      `}</style>
    </div>
  )
}
