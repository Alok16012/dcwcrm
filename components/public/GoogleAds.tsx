'use client'
import Script from 'next/script'
import { useEffect } from 'react'
import { GOOGLE_ADS_ID, reportConversion } from '@/lib/googleAds'

/**
 * Google Ads tag for the public lead-capture pages.
 *
 * Mirrors MetaPixel: base tag on load, and the conversion fires from the
 * form on a successful submit. Phone clicks are caught here instead,
 * through one delegated listener — these pages render the number in more
 * than one place and a per-link handler would miss whichever one gets
 * added next.
 *
 * Renders nothing unless NEXT_PUBLIC_GOOGLE_ADS_ENABLED is set, so the
 * dashboard and any preview deploy stay untracked.
 */
export function GoogleAds() {
  const enabled = process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === 'true'

  useEffect(() => {
    if (!enabled) return
    // Capture phase: a tel: link opens the dialer and can tear the page
    // down before a bubbling listener ever runs.
    function onClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest('a[href^="tel:"]')
      if (link) reportConversion('phoneClick')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [enabled])

  if (!enabled) return null

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GOOGLE_ADS_ID}');
        `}
      </Script>
    </>
  )
}
