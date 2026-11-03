/**
 * The festive window — one place, so the fireworks greeting and the dashboard
 * decorations switch on and off together instead of drifting apart.
 *
 * Dates are IST calendar days ('yyyy-MM-dd'). Outside the window everything
 * festive renders nothing, so the decorations retire on their own.
 */

// Dhanteras (6 Nov) to Bhai Dooj (11 Nov) 2026, with a couple of days either side
export const FESTIVAL_START = '2026-11-03'
export const FESTIVAL_END = '2026-11-12'

/** Today's date in IST, as 'yyyy-MM-dd'. */
export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

export function isFestive(day: string = todayIST()): boolean {
  return day >= FESTIVAL_START && day <= FESTIVAL_END
}
