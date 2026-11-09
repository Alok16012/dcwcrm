/**
 * Chhath Puja dressing for a dashboard page, built from separate pieces the
 * way the festival banner is: a marigold toran across the top with strands
 * down both sides, the sun rising behind the greeting, two women standing in
 * the river — one offering arghya from a lota, one holding the soop of fruits
 * — diyas on the water, and petals drifting over the page.
 *
 * Everything is pointer-events-none and sits above or behind the content
 * without covering it. Pure SVG + CSS, no images. Shown only in the CHHATH
 * window (./festival).
 */

import { ChhathCelebration } from './ChhathCelebration'
import { ChhathBand, ChhathBandMobile, ChhathBandStyles, ChhathGhat } from './ChhathBand'

const MARIGOLD = ['#f97316', '#fb923c', '#f59e0b', '#fbbf24', '#ea580c']
const SKIN = '#c98b5e'
const SKIN_SHADE = '#b07148'

/** One puffy marigold. */
export function Marigold({ cx, cy, r, i }: { cx: number; cy: number; r: number; i: number }) {
  const c = MARIGOLD[i % MARIGOLD.length]
  return (
    <g>
      {[0, 1, 2, 3, 4, 5].map(k => {
        const a = (k / 6) * Math.PI * 2 + i
        return <circle key={k} cx={Math.round((cx + Math.cos(a) * r * 0.5) * 10) / 10} cy={Math.round((cy + Math.sin(a) * r * 0.5) * 10) / 10} r={r * 0.55} fill={c} />
      })}
      <circle cx={cx} cy={cy} r={r * 0.32} fill="#c2410c" opacity="0.5" />
    </g>
  )
}

/** One swag of the toran: marigolds along a dip, a mango-leaf tassel at the join. */
function Swag({ i }: { i: number }) {
  const pts = Array.from({ length: 7 }, (_, k) => {
    const t = k / 6
    return { x: 6 + t * 148, y: 10 + Math.sin(t * Math.PI) * 18 }
  })
  return (
    <svg viewBox="0 0 160 70" className="h-[46px] md:h-[60px] w-auto shrink-0" aria-hidden>
      <path d={`M ${pts.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke="#92400e" strokeWidth="1.2" fill="none" opacity="0.5" />
      {pts.map((p, k) => <Marigold key={k} cx={p.x} cy={p.y} r={7.5} i={k + i} />)}
      {/* mango leaves hanging from the join */}
      <path d="M6 18 q -6 18 0 40 q 6 -22 0 -40" fill="#15803d" />
      <path d="M6 18 q 5 14 9 26 q -9 -8 -9 -26" fill="#166534" opacity="0.8" />
    </svg>
  )
}

/** A strand of marigolds hanging down a side. */
export function Strand({ count, className }: { count: number; className: string }) {
  return (
    <svg viewBox={`0 0 24 ${count * 18 + 20}`} className={className} aria-hidden>
      <line x1="12" y1="0" x2="12" y2={count * 18} stroke="#92400e" strokeWidth="1" opacity="0.5" />
      {Array.from({ length: count }, (_, k) => <Marigold key={k} cx={12} cy={10 + k * 18} r={8} i={k} />)}
      <path d={`M7 ${count * 18 + 4} q 5 -10 10 0 l 1 5 h -12 z`} fill="#d4a017" />
    </svg>
  )
}

/** The rising sun, rays turning slowly. */
function Sun({ id, className }: { id: string; className: string }) {
  return (
    <svg viewBox="0 0 300 300" className={className} aria-hidden>
      <defs>
        <radialGradient id={`ch-halo-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#fdba74" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#fdba74" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`ch-disc-${id}`} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="45%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="150" fill={`url(#ch-halo-${id})`} />
      <g className="ch-rays" style={{ transformOrigin: '150px 150px' }}>
        {Array.from({ length: 18 }, (_, i) => (
          <rect key={i} x="146" y="20" width="8" height="40" rx="4" fill="#f59e0b" opacity="0.4" transform={`rotate(${i * 20} 150 150)`} />
        ))}
      </g>
      <circle cx="150" cy="150" r="64" fill={`url(#ch-disc-${id})`} />
    </svg>
  )
}

/** A face in three-quarter view: pallu over the head, bindi, nose ring, earring. */
function Head({ x, y, dir, saree, border }: { x: number; y: number; dir: 1 | -1; saree: string; border: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${dir} 1)`}>
      {/* hair bun behind */}
      <circle cx={-14} cy={6} r={12} fill="#1f2937" />
      {/* pallu over the head */}
      <path d="M -30 10 C -30 -26, 26 -32, 28 0 L 24 26 C 10 8, -14 6, -26 38 Z" fill={saree} />
      <path d="M -30 10 C -30 -26, 26 -32, 28 0" stroke={border} strokeWidth="4" fill="none" />
      {/* face */}
      <path d="M -2 -10 C 20 -12, 26 10, 20 26 C 14 36, -4 36, -8 22 C -12 10, -12 -6, -2 -10 Z" fill={SKIN} />
      {/* hair at the forehead */}
      <path d="M -6 -8 C 6 -14, 18 -10, 24 -2 C 14 -6, 2 -6, -6 0 Z" fill="#1f2937" />
      {/* eye, brow, nose, lips, bindi */}
      <path d="M 9 6 q 4 -3 8 0" stroke="#1f2937" strokeWidth="1.6" fill="none" />
      <ellipse cx={13} cy={9} rx={2} ry={1.4} fill="#1f2937" />
      <path d="M 22 10 q 3 6 -1 8" stroke={SKIN_SHADE} strokeWidth="1.6" fill="none" />
      <path d="M 14 25 q 4 2 7 -1" stroke="#be123c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx={16} cy={-1} r={1.8} fill="#dc2626" />
      <circle cx={22} cy={18} r={2.2} fill="none" stroke="#eab308" strokeWidth="1.2" />
      {/* earring */}
      <circle cx={-6} cy={20} r={3} fill="#eab308" />
    </g>
  )
}

/** The woman offering arghya: lota tipped, water streaming into the river. */
export function WomanArghya({ className }: { className: string }) {
  const saree = '#9f1239', border = '#facc15'
  return (
    <svg viewBox="0 0 220 300" className={className} aria-hidden>
      {/* torso: blouse and saree */}
      <path d="M 62 128 C 60 112, 120 108, 124 128 L 132 300 L 52 300 Z" fill={saree} />
      <path d="M 66 126 C 78 118, 112 116, 122 126 L 120 152 C 104 146, 82 146, 68 152 Z" fill="#15803d" />
      {/* pallu across the chest */}
      <path d="M 64 126 L 120 196 L 128 300 L 108 300 L 60 160 Z" fill={saree} />
      <path d="M 64 126 L 122 198 L 130 300" stroke={border} strokeWidth="5" fill="none" />
      {/* neck */}
      <rect x="84" y="100" width="14" height="20" rx="6" fill={SKIN} />
      <path d="M 80 118 q 12 10 24 0" stroke="#eab308" strokeWidth="2" fill="none" />
      <Head x={90} y={74} dir={1} saree={saree} border={border} />
      {/* arms reaching out with the lota */}
      <path d="M 112 138 C 130 150, 146 150, 160 140" stroke={SKIN} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M 104 152 C 126 166, 148 164, 160 152" stroke={SKIN_SHADE} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M 150 141 l 4 10 M 154 140 l 4 10" stroke="#dc2626" strokeWidth="3" />
      {/* lota, tipped */}
      <g transform="rotate(-28 172 140)">
        <ellipse cx="172" cy="146" rx="16" ry="14" fill="#c2410c" />
        <ellipse cx="172" cy="141" rx="12" ry="5" fill="#ea580c" />
        <rect x="164" y="128" width="16" height="7" rx="3" fill="#b45309" />
        <ellipse cx="168" cy="146" rx="4" ry="8" fill="#fdba74" opacity="0.5" />
      </g>
      {/* water streaming down */}
      <path className="ch-pour" d="M 186 130 C 198 160, 196 220, 200 300" stroke="#38bdf8" strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray="14 10" opacity="0.85" />
      <path className="ch-pour" d="M 190 134 C 204 170, 206 230, 210 300" stroke="#7dd3fc" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="8 12" opacity="0.8" style={{ animationDuration: '0.9s' }} />
    </svg>
  )
}

/** The woman holding the soop of fruits up to the sun. */
export function WomanSoop({ className }: { className: string }) {
  const saree = '#dc2626', border = '#facc15'
  return (
    <svg viewBox="0 0 220 300" className={className} aria-hidden>
      {/* torso */}
      <path d="M 96 128 C 100 112, 158 112, 160 128 L 168 300 L 88 300 Z" fill={saree} />
      <path d="M 100 126 C 110 116, 146 118, 156 126 L 152 152 C 138 146, 116 146, 102 152 Z" fill="#ca8a04" />
      <path d="M 158 126 L 102 196 L 96 300 L 116 300 L 160 160 Z" fill={saree} />
      <path d="M 158 126 L 100 198 L 94 300" stroke={border} strokeWidth="5" fill="none" />
      {/* checks on the saree */}
      {Array.from({ length: 12 }, (_, k) => (
        <circle key={k} cx={110 + (k % 4) * 14} cy={220 + Math.floor(k / 4) * 22} r="2.2" fill="#fde68a" opacity="0.7" />
      ))}
      <rect x="122" y="100" width="14" height="20" rx="6" fill={SKIN} />
      <path d="M 118 118 q 12 10 24 0" stroke="#eab308" strokeWidth="2" fill="none" />
      <Head x={130} y={74} dir={-1} saree={saree} border={border} />
      {/* arms holding the soop out in front */}
      <path d="M 108 140 C 92 150, 76 150, 62 140" stroke={SKIN} strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M 116 154 C 96 166, 76 164, 64 152" stroke={SKIN_SHADE} strokeWidth="12" fill="none" strokeLinecap="round" />
      <path d="M 70 141 l -3 10 M 66 140 l -3 10" stroke="#16a34a" strokeWidth="3" />
      {/* soop: a bamboo winnowing fan, held tilted up */}
      <g transform="rotate(-10 50 130)">
        <path d="M 8 132 Q 50 112 96 132 Q 90 150 50 152 Q 12 150 8 132 Z" fill="#d4a24c" />
        {Array.from({ length: 7 }, (_, k) => (
          <path key={k} d={`M ${18 + k * 11} 128 L ${20 + k * 10} 150`} stroke="#a16207" strokeWidth="1" opacity="0.6" />
        ))}
        <path d="M 8 132 Q 50 112 96 132" stroke="#a16207" strokeWidth="3" fill="none" />
        {/* fruits and offerings */}
        <path d="M 22 124 q 10 -18 26 -10" stroke="#facc15" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M 26 128 q 10 -16 24 -8" stroke="#eab308" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="58" cy="118" r="8" fill="#f97316" />
        <circle cx="72" cy="122" r="7" fill="#dc2626" />
        <circle cx="46" cy="120" r="7" fill="#78350f" />
        <rect x="80" y="96" width="4" height="30" rx="2" fill="#4d7c0f" transform="rotate(12 82 111)" />
        <rect x="86" y="100" width="4" height="26" rx="2" fill="#65a30d" transform="rotate(20 88 113)" />
        <path d="M 36 112 l 4 -12 l 4 12" fill="#fbbf24" />
        <ellipse cx="40" cy="113" rx="6" ry="3" fill="#c2410c" />
        <path className="ch-flame" d="M 40 100 q 4 6 0 10 q -4 -4 0 -10" fill="#fde047" />
      </g>
    </svg>
  )
}

/** River band with moving waves; drawn in front of the women's skirts. */
function River({ id, className }: { id: string; className: string }) {
  const wave = (y: number) => {
    let d = `M0 ${y}`
    for (let x = 0; x <= 2400; x += 100) d += ` Q ${x + 50} ${y - 12} ${x + 100} ${y}`
    return `${d} V 120 H 0 Z`
  }
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`ch-water-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <g className="ch-wave"><path d={wave(24)} fill={`url(#ch-water-${id})`} /></g>
      <g className="ch-wave ch-wave-slow"><path d={wave(52)} fill="#0ea5e9" opacity="0.55" /></g>
      <rect y="100" width="1200" height="20" fill="#d97706" opacity="0.9" />
      <path d="M0 104 H1200" stroke="#fde68a" strokeWidth="3" strokeDasharray="10 8" />
    </svg>
  )
}

/**
 * The festival scene across the top of the page — toran, sun, greeting, the
 * two women in the river — sized to bleed to the page edges.
 */
export function ChhathHero({ name, id = 'page', subtitle = true }: { name?: string; id?: string; subtitle?: boolean }) {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return (
    <div aria-label="Happy Chhath Puja" className="relative h-[250px] md:h-[330px] overflow-hidden pointer-events-none select-none">
      {/* toran across the top */}
      <div className="absolute inset-x-0 top-0 z-20 flex -space-x-1">
        {Array.from({ length: 11 }, (_, i) => <Swag key={i} i={i} />)}
      </div>
      {/* strands down both sides */}
      <Strand count={11} className="absolute left-1 top-4 z-20 h-[230px] md:h-[300px] w-auto" />
      <Strand count={11} className="absolute right-1 top-4 z-20 h-[230px] md:h-[300px] w-auto" />

      {/* sun rising behind the greeting */}
      <div className="ch-rise absolute left-1/2 top-2 md:top-0">
        <Sun id={id} className="w-[220px] md:w-[300px] h-auto" />
      </div>

      {/* greeting */}
      <div className="ch-in absolute inset-x-0 top-[62px] md:top-[78px] z-10 flex flex-col items-center px-24 md:px-56 text-center">
        <p className="font-serif italic text-2xl md:text-4xl font-bold text-orange-600 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">Happy</p>
        <p className="-mt-1 text-4xl md:text-6xl font-extrabold text-rose-900 drop-shadow-[0_2px_0_rgba(255,255,255,0.7)]">छठ पूजा</p>
        {subtitle && <p className="mt-1 hidden sm:block max-w-md text-xs md:text-sm font-medium text-rose-900/80">
          {first ? `${first}, ` : ''}Surya Dev aapko sehat, urja aur samriddhi dein 🙏
        </p>}
      </div>

      {/* the two women, standing in the river */}
      <WomanArghya className="ch-woman absolute bottom-6 left-[4%] md:left-[7%] w-[110px] md:w-[220px] h-auto z-10" />
      <WomanSoop className="ch-woman absolute bottom-6 right-[4%] md:right-[7%] w-[110px] md:w-[220px] h-auto z-10" />

      {/* river in front of them */}
      <River id={id} className="absolute inset-x-0 bottom-0 z-10 h-[64px] md:h-[84px] w-full" />
      {[20, 38, 60, 78].map((left, i) => (
        <span key={left} className="ch-diya absolute z-10 text-lg md:text-2xl" style={{ left: `${left}%`, bottom: `${18 + (i % 2) * 12}px`, animationDelay: `${i * 0.8}s` }}>🪔</span>
      ))}
    </div>
  )
}

/** Soft dawn wash behind the whole page. */
export function ChhathBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
      background:
        'radial-gradient(1000px 380px at 50% 0%, rgba(253,186,116,0.35), transparent 70%),' +
        'linear-gradient(180deg, #fff1e2 0%, #fff7ed 25%, #fffbf5 55%, #fffdf9 100%)',
    }} />
  )
}

/** Petals drifting down the page, never catching a click. */
export function ChhathPetals({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 z-30 overflow-hidden ${className}`}>
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="ch-petal absolute -top-6 rounded-[60%_0_60%_0]" style={{
          left: `${(i * 41 + 7) % 100}%`,
          width: 9 + (i % 4) * 2, height: 6 + (i % 4) * 2,
          background: ['#f97316', '#fbbf24', '#f59e0b', '#ef4444'][i % 4],
          animationDelay: `${(i * 1.3) % 12}s`, animationDuration: `${11 + (i % 5) * 2}s`,
          ['--drift' as string]: `${(i % 2 ? 1 : -1) * (30 + (i * 17) % 60)}px`,
        }} />
      ))}
    </div>
  )
}

export function ChhathStyles() {
  return (
    <style>{`
      .ch-rise { animation: ch-rise 2.4s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
      @keyframes ch-rise { from { transform: translate(-50%, 90px); opacity: 0.3; } to { transform: translate(-50%, 0); opacity: 1; } }
      .ch-rays { animation: ch-spin 45s linear infinite; }
      @keyframes ch-spin { to { transform: rotate(360deg); } }
      .ch-wave { animation: ch-wave 8s linear infinite; }
      .ch-wave-slow { animation-duration: 13s; animation-direction: reverse; }
      @keyframes ch-wave { from { transform: translateX(0); } to { transform: translateX(-200px); } }
      .ch-pour { animation: ch-pour 0.7s linear infinite; }
      @keyframes ch-pour { to { stroke-dashoffset: -24; } }
      .ch-flame { animation: ch-flicker 1.4s ease-in-out infinite; transform-origin: 40px 108px; }
      @keyframes ch-flicker { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15, 0.9); } }
      .ch-woman { animation: ch-woman 1.2s cubic-bezier(0.2, 1, 0.4, 1) both; }
      @keyframes ch-woman { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: none; } }
      .ch-diya { animation: ch-bob 3.2s ease-in-out infinite; will-change: transform; text-shadow: 0 0 10px rgba(253,186,116,0.95); }
      @keyframes ch-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-5px) rotate(3deg); } }
      .ch-petal { opacity: 0; animation-name: ch-fall; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes ch-fall {
        0% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
        8% { opacity: 0.85; }
        92% { opacity: 0.7; }
        100% { opacity: 0; transform: translate(var(--drift), 105vh) rotate(600deg); }
      }
      .ch-in { animation: ch-in 0.9s 0.3s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
      @keyframes ch-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @media (max-width: 767px) {
        .ch-rays, .ch-pour, .ch-flame { animation: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ch-rise, .ch-rays, .ch-wave, .ch-pour, .ch-flame, .ch-woman, .ch-diya, .ch-in { animation: none; }
        .ch-rise { transform: translateX(-50%); }
        .ch-petal { display: none; }
      }
    `}</style>
  )
}

/** The theme around a page: dawn wash, festival scene on top, petals. */
export function ChhathPage({ name, className = '', heroClassName = '', children }: {
  name?: string; className?: string; heroClassName?: string; children: React.ReactNode
}) {
  return (
    <div className={`relative isolate md:pb-40 ${className}`}>
      <ChhathStyles />
      <ChhathBackdrop />
      {/* On a phone the wish plays as a moment and leaves (ChhathCelebration);
          bigger screens keep the scene on the page. */}
      <ChhathPetals className="hidden md:block" />
      <ChhathBandStyles />
      <div className={`mb-5 hidden md:block ${heroClassName}`}><ChhathBand id="portal" /></div>
      <div className={`mb-4 md:hidden ${heroClassName}`}><ChhathBandMobile /></div>
      <div className="hidden md:block"><ChhathGhat /></div>
      <ChhathCelebration name={name} />
      {children}
    </div>
  )
}

/** ChhathPage when `on`, otherwise just the children. */
export function ChhathWrap({ on, ...props }: { on: boolean; name?: string; className?: string; heroClassName?: string; children: React.ReactNode }) {
  return on ? <ChhathPage {...props} /> : <>{props.children}</>
}
