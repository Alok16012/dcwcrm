/**
 * The festive window — one place, so the fireworks greeting and the dashboard
 * decorations switch on and off together instead of drifting apart.
 *
 * Dates are IST calendar days ('yyyy-MM-dd'). Outside the window everything
 * festive renders nothing, so the decorations retire on their own.
 */

// Diwali 2026 (Dhanteras to Diwali). Ended early on request so Chhath can
// take the dashboard; the Diwali fireworks and torans read this window.
export const FESTIVAL_START = '2026-11-03'
export const FESTIVAL_END = '2026-11-08'

// Chhath Puja 2026 — the dashboards wear the Chhath theme (ChhathTheme.tsx).
export const CHHATH_START = '2026-11-09'
export const CHHATH_END = '2026-11-16'

/** Today's date in IST, as 'yyyy-MM-dd'. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

export function isFestive(day: string = todayIST()): boolean {
  return day >= FESTIVAL_START && day <= FESTIVAL_END
}

export function isChhath(day: string = todayIST()): boolean {
  return day >= CHHATH_START && day <= CHHATH_END
}
