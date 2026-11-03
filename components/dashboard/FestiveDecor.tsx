/**
 * Diwali dressing for the dashboard: marigold torans hanging from the two top
 * corners, a lit diya in the bottom-left, gold swirls and a warm ivory wash.
 *
 * Pure SVG + CSS, no images to load. Everything is pointer-events-none, so it
 * never blocks a click, and the backdrop and diya sit *behind* the cards — they
 * show in the gaps, never over a number someone is reading.
 *
 * Rendered only inside the festival window (see ./festival); the page decides
 * on the server, so there is no flash or hydration mismatch.
 */

const MARIGOLD = ['#f97316', '#fb923c', '#f59e0b', '#fbbf24', '#ea580c']

/**
 * Round to 2 decimals. Math.sin/cos can differ in the last digit between the
 * server (Node) and the browser, and React treats "7.71317425126703" vs
 * "7.713174251267029" as a hydration mismatch. Rounded, both agree.
 */
const r2 = (n: number) => Math.round(n * 100) / 100

/** One puffy marigold: a ring of petals around a darker centre. */
function Marigold({ cx, cy, r, i }: { cx: number; cy: number; r: number; i: number }) {
  const c = MARIGOLD[i % MARIGOLD.length]
  const petals = 9
  return (
    <g>
      {Array.from({ length: petals }, (_, k) => {
        const a = (k / petals) * Math.PI * 2 + i
        return (
          <circle
            key={k}
            cx={r2(cx + Math.cos(a) * r * 0.55)}
            cy={r2(cy + Math.sin(a) * r * 0.55)}
            r={r2(r * 0.55)}
            fill={c}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r2(r * 0.6)} fill={c} />
      <circle cx={cx} cy={cy} r={r2(r * 0.32)} fill="#c2410c" opacity={0.55} />
    </g>
  )
}

function Leaf({ x, y, rot }: { x: number; y: number; rot: number }) {
  return (
    <path
      d="M0 0 C 4 -5, 11 -5, 14 0 C 11 5, 4 5, 0 0 Z"
      fill="#16a34a"
      transform={`translate(${x} ${y}) rotate(${rot})`}
      opacity={0.9}
    />
  )
}

/**
 * The garland for one corner: a swag dipping along the top edge, plus strands
 * hanging down the outer side, each ending in a small brass bell.
 */
function Toran({ side }: { side: 'left' | 'right' }) {
  // Swag: a curve from the corner across the top, marigolds placed along it.
  const swag = Array.from({ length: 11 }, (_, k) => {
    const t = k / 10
    const x = r2(14 + t * 250)
    const y = r2(12 + Math.sin(t * Math.PI) * 26)
    return { x, y }
  })
  // Strands of different lengths, hanging from the outer edge.
  // Kept to the outer ~55px so they hang in the margin, clear of the content.
  const strands = [
    { x: 14, len: 8 },
    { x: 36, len: 5 },
    { x: 56, len: 3 },
  ]

  return (
    <svg
      viewBox="0 0 280 230"
      className={`absolute top-0 ${side === 'left' ? 'left-0' : 'right-0 -scale-x-100'} w-[200px] lg:w-[280px] h-auto drop-shadow-sm`}
      aria-hidden="true"
    >
      {/* string */}
      <path
        d={`M ${swag.map(p => `${p.x} ${p.y}`).join(' L ')}`}
        stroke="#b45309"
        strokeWidth={1.5}
        fill="none"
        opacity={0.7}
      />
      {strands.map(s => (
        <line key={s.x} x1={s.x} y1={12} x2={s.x} y2={12 + s.len * 20} stroke="#b45309" strokeWidth={1.2} opacity={0.6} />
      ))}

      {/* leaves between the flowers */}
      {swag.slice(0, -1).map((p, k) => (
        <Leaf key={`l${k}`} x={r2((p.x + swag[k + 1].x) / 2 - 7)} y={r2((p.y + swag[k + 1].y) / 2 + 6)} rot={k % 2 ? 20 : -20} />
      ))}

      {/* marigolds along the swag */}
      {swag.map((p, k) => <Marigold key={`s${k}`} cx={p.x} cy={p.y} r={9} i={k} />)}

      {/* hanging strands */}
      {strands.map((s, si) => (
        <g key={`st${si}`}>
          {Array.from({ length: s.len }, (_, k) => (
            <Marigold key={k} cx={s.x} cy={30 + k * 20} r={8} i={k + si * 3} />
          ))}
          {/* brass bell at the end */}
          <path
            d={`M ${s.x - 5} ${30 + s.len * 20 - 4} q 5 -10 10 0 l 1 5 h -12 z`}
            fill="#d4a017"
          />
          <circle cx={s.x} cy={30 + s.len * 20 + 2} r={1.6} fill="#92400e" />
        </g>
      ))}
    </svg>
  )
}

/** A clay diya with a flickering flame and a soft glow, plus gold swirls. */
function Diya() {
  return (
    <svg viewBox="0 0 260 150" className="w-[200px] lg:w-[240px] h-auto" aria-hidden="true">
      <defs>
        <radialGradient id="dcw-diya-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity={0.85} />
          <stop offset="45%" stopColor="#fbbf24" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="dcw-diya-clay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="55%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <linearGradient id="dcw-diya-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fffbeb" />
        </linearGradient>
      </defs>

      {/* gold swirls */}
      <g fill="none" stroke="#d4a017" strokeWidth={1.4} strokeLinecap="round" opacity={0.55}>
        <path d="M 8 120 C 30 70, 70 110, 60 80 C 52 58, 30 70, 40 84" />
        <path d="M 150 128 C 190 100, 230 132, 250 100 C 258 86, 240 76, 232 90" />
        <path d="M 20 140 C 60 130, 120 146, 170 138" />
        <path d="M 196 60 c 10 -14 26 -6 20 6 c -4 8 -14 4 -10 -2" />
      </g>

      {/* glow */}
      <ellipse className="dcw-diya-glow" cx={120} cy={62} rx={62} ry={50} fill="url(#dcw-diya-glow)" />

      {/* flame */}
      <g className="dcw-diya-flame" style={{ transformOrigin: '120px 92px' }}>
        <path d="M 120 50 C 132 68, 134 82, 120 92 C 106 82, 108 68, 120 50 Z" fill="url(#dcw-diya-flame)" />
        <path d="M 120 68 C 125 76, 125 84, 120 89 C 115 84, 115 76, 120 68 Z" fill="#fffbeb" opacity={0.9} />
      </g>
      {/* wick */}
      <line x1={120} y1={92} x2={121} y2={99} stroke="#292524" strokeWidth={2} />

      {/* bowl */}
      <path d="M 72 98 Q 120 92 168 98 Q 162 132 120 136 Q 78 132 72 98 Z" fill="url(#dcw-diya-clay)" />
      {/* spout */}
      <path d="M 160 99 Q 178 94 182 98 Q 174 106 164 106 Z" fill="#c2410c" />
      {/* rim + oil */}
      <ellipse cx={120} cy={99} rx={48} ry={7} fill="#7c2d12" />
      <ellipse cx={120} cy={98} rx={44} ry={5} fill="#facc15" opacity={0.35} />
      {/* painted band */}
      <path d="M 82 112 Q 120 120 158 112" stroke="#fde68a" strokeWidth={2} fill="none" strokeDasharray="2 5" strokeLinecap="round" />
    </svg>
  )
}

/** Small twinkling lights scattered near the top. */
function Sparkles() {
  const dots = [
    { l: '18%', t: 28, d: '0s' }, { l: '34%', t: 14, d: '1.1s' }, { l: '52%', t: 22, d: '0.5s' },
    { l: '66%', t: 10, d: '1.6s' }, { l: '81%', t: 30, d: '0.8s' },
  ]
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="dcw-sparkle absolute w-1.5 h-1.5 rounded-full bg-amber-300"
          style={{ left: d.l, top: d.t, animationDelay: d.d, boxShadow: '0 0 8px 2px rgba(251,191,36,0.7)' }}
        />
      ))}
    </>
  )
}

/** Behind the cards: the warm wash and the diya. */
export function FestiveBackdrop() {
  return (
    <div aria-hidden="true" className="hidden md:block pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-none">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 400px at 50% -80px, rgba(251,191,36,0.16), transparent 70%),' +
            'radial-gradient(500px 300px at 0% 100%, rgba(249,115,22,0.10), transparent 70%),' +
            'linear-gradient(180deg, #fffaf0 0%, #fff7ed 45%, #fffbeb 100%)',
        }}
      />
    </div>
  )
}

/** Over the cards, but only along the edges: the torans and the lights. */
export function FestiveGarlands() {
  return (
    <div aria-hidden="true" className="hidden md:block pointer-events-none absolute inset-x-0 top-0 h-60 z-20 overflow-hidden">
      <Toran side="left" />
      <Toran side="right" />
      <Sparkles />
    </div>
  )
}

/**
 * The diya, bottom-left of the dashboard, behind the cards — it shows in the
 * empty space under them and never covers a number. The festive wrapper is at
 * least a screen tall, so on a short dashboard this is the bottom of the view.
 */
export function FestiveDiya() {
  return (
    <div aria-hidden="true" className="hidden md:block pointer-events-none absolute bottom-0 left-2 -z-10">
      <Diya />
    </div>
  )
}

/** Keyframes for the flame, glow and sparkles; off for reduced-motion users. */
export function FestiveStyles() {
  return (
    <style>{`
      @keyframes dcw-flicker { 0%,100% { transform: scale(1) rotate(-1deg) } 35% { transform: scale(1.06, 0.95) rotate(2deg) } 70% { transform: scale(0.96, 1.05) rotate(-2deg) } }
      @keyframes dcw-glow { 0%,100% { opacity: .85 } 50% { opacity: 1 } }
      @keyframes dcw-twinkle { 0%,100% { opacity: .2; transform: scale(.7) } 50% { opacity: 1; transform: scale(1.2) } }
      .dcw-diya-flame { animation: dcw-flicker 1.6s ease-in-out infinite }
      .dcw-diya-glow { animation: dcw-glow 2.4s ease-in-out infinite }
      .dcw-sparkle { animation: dcw-twinkle 2.8s ease-in-out infinite }
      @media (prefers-reduced-motion: reduce) {
        .dcw-diya-flame, .dcw-diya-glow, .dcw-sparkle { animation: none }
      }
    `}</style>
  )
}
