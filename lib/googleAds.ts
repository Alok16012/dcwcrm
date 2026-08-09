/**
 * Google Ads conversion tracking.
 *
 * Generated from the live Ads account (1864528952) — do not hand-edit the
 * labels. They ship in the page source, so they are public values, not
 * secrets.
 *
 * Nothing here throws if gtag is absent: an ad blocker or a failed script
 * load must never stop a lead form from submitting.
 */

export const GOOGLE_ADS_ID = "AW-11521323955"

/** send_to values, one per conversion action in the Ads account. */
export const CONVERSIONS = {
  formSubmit: "AW-11521323955/FAQyCK2iv94cELPn5fUq",
  phoneClick: "AW-11521323955/KqvDCLCiv94cELPn5fUq",
} as const

export type ConversionKey = keyof typeof CONVERSIONS

declare global {
  interface Window {
    gtag?: (command: string, action: string, params?: Record<string, unknown>) => void
    dataLayer?: unknown[]
  }
}

export function reportConversion(
  key: ConversionKey,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', 'conversion', { send_to: CONVERSIONS[key], ...params })
}
