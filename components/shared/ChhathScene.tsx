/**
 * Built-in Chhath Puja greeting, drawn in code so it shows with no upload:
 * a sun rising over the ghat, moving water, diyas floating on it and a
 * marigold toran. GreetingBanner falls back to it during BUILTIN_GREETINGS
 * dates when the admin hasn't uploaded a banner of their own.
 */
export function ChhathScene() {
  return (
    <div className="chhath relative w-full overflow-hidden" style={{ aspectRatio: '16 / 7' }}>
      <svg viewBox="0 0 800 350" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="chhath-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#fdba74" />
            <stop offset="75%" stopColor="#fb923c" />
          </linearGradient>
          <radialGradient id="chhath-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7d6" />
            <stop offset="55%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#f97316" />
          </radialGradient>
          <radialGradient id="chhath-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="chhath-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        <rect width="800" height="350" fill="url(#chhath-sky)" />

        {/* Sun rising behind the water, rays turning slowly */}
        <g className="chhath-rise">
          <circle cx="400" cy="232" r="150" fill="url(#chhath-glow)" />
          <g className="chhath-rays" style={{ transformOrigin: '400px 232px' }}>
            {Array.from({ length: 16 }, (_, i) => (
              <rect key={i} x="397" y="92" width="6" height="40" rx="3" fill="#fbbf24" opacity="0.55"
                transform={`rotate(${i * 22.5} 400 232)`} />
            ))}
          </g>
          <circle cx="400" cy="232" r="72" fill="url(#chhath-sun)" />
        </g>

        {/* River */}
        <rect y="235" width="800" height="115" fill="url(#chhath-water)" />
        {/* Sun's reflection */}
        {[0, 1, 2, 3].map(i => (
          <ellipse key={i} className="chhath-shimmer" cx="400" cy={250 + i * 18} rx={60 - i * 10} ry="3.5" fill="#fde68a"
            style={{ animationDelay: `${i * 0.4}s` }} />
        ))}
        <g className="chhath-wave">
          <path d="M0 250 Q 50 240 100 250 T 200 250 T 300 250 T 400 250 T 500 250 T 600 250 T 700 250 T 800 250 T 900 250 T 1000 250 V 350 H 0 Z"
            fill="#0ea5e9" opacity="0.35" />
        </g>
        <g className="chhath-wave chhath-wave2">
          <path d="M0 275 Q 50 265 100 275 T 200 275 T 300 275 T 400 275 T 500 275 T 600 275 T 700 275 T 800 275 T 900 275 T 1000 275 V 350 H 0 Z"
            fill="#0284c7" opacity="0.45" />
        </g>

        {/* Marigold toran */}
        <path d="M0 6 Q 200 40 400 6 T 800 6" fill="none" stroke="#166534" strokeWidth="2" opacity="0.4" />
        {Array.from({ length: 33 }, (_, i) => {
          const x = i * 25
          const y = 6 + 34 * Math.sin((Math.PI * (x % 400)) / 400) * (x < 400 ? 1 : 1)
          return <circle key={i} cx={x} cy={y} r="8" fill={i % 2 ? '#f59e0b' : '#f97316'} />
        })}
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${50 + i * 100} 26 q -7 16 0 30 q 7 -14 0 -30`} fill="#15803d" />
        ))}
      </svg>

      {/* Diyas on the water */}
      {[12, 30, 68, 86].map((left, i) => (
        <span key={left} className="chhath-diya absolute text-2xl sm:text-3xl" style={{ left: `${left}%`, bottom: `${10 + (i % 2) * 7}%`, animationDelay: `${i * 0.7}s` }}>
          🪔
        </span>
      ))}

      {/* Greeting */}
      <div className="absolute inset-x-0 top-[13%] flex flex-col items-center px-4 text-center">
        <p className="chhath-text text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-rose-800/80">Happy Chhath Puja</p>
        <p className="chhath-text mt-1 text-3xl sm:text-5xl font-extrabold text-rose-900 drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]" style={{ animationDelay: '0.15s' }}>
          छठ पूजा
        </p>
        <p className="chhath-text mt-1 text-sm sm:text-lg font-semibold text-rose-900/90" style={{ animationDelay: '0.3s' }}>
          की हार्दिक शुभकामनाएं
        </p>
      </div>

      <style>{`
        .chhath-rise { animation: chhath-rise 2.2s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
        @keyframes chhath-rise { from { transform: translateY(70px); opacity: 0.4; } to { transform: none; opacity: 1; } }
        .chhath-rays { animation: chhath-spin 40s linear infinite; }
        @keyframes chhath-spin { to { transform: rotate(360deg); } }
        .chhath-wave { animation: chhath-wave 7s linear infinite; }
        .chhath-wave2 { animation-duration: 11s; animation-direction: reverse; }
        @keyframes chhath-wave { from { transform: translateX(0); } to { transform: translateX(-200px); } }
        .chhath-shimmer { animation: chhath-shimmer 2.4s ease-in-out infinite; }
        @keyframes chhath-shimmer { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.85; } }
        .chhath-diya { animation: chhath-bob 3s ease-in-out infinite; filter: drop-shadow(0 0 8px rgba(253, 186, 116, 0.95)); }
        @keyframes chhath-bob { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
        .chhath-text { animation: chhath-text 0.9s cubic-bezier(0.2, 1.2, 0.4, 1) both; }
        @keyframes chhath-text { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .chhath-rise, .chhath-rays, .chhath-wave, .chhath-shimmer, .chhath-diya, .chhath-text { animation: none; }
        }
      `}</style>
    </div>
  )
}
