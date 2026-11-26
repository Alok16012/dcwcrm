'use client'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { forwardRef, useRef, type ComponentProps } from 'react'

/**
 * next/link that prefetches on intent (hover, touch, keyboard focus), not on
 * sight.
 *
 * A plain <Link> prefetches every link that scrolls into view. Every page here
 * is dynamic, so each prefetch is a full server render: the proxy's login
 * check, the layout and the page's own Supabase queries. Opening the dashboard
 * fired ~20 of them at once (one per sidebar entry, plus the dashboard's own
 * lead and appointment links), and the page the user actually clicked queued
 * behind them. Prefetching on hover still gets a head start of a few hundred
 * milliseconds before the click lands.
 *
 * Pass prefetch explicitly to get next/link's own behaviour back.
 */
type Props = ComponentProps<typeof NextLink>

const AppLink = forwardRef<HTMLAnchorElement, Props>(function AppLink(
  { prefetch, onMouseEnter, onTouchStart, onFocus, href, ...rest },
  ref
) {
  const router = useRouter()
  const done = useRef(false)

  if (prefetch !== undefined) {
    return <NextLink ref={ref} href={href} prefetch={prefetch} onMouseEnter={onMouseEnter} onTouchStart={onTouchStart} onFocus={onFocus} {...rest} />
  }

  const warm = () => {
    if (done.current || typeof href !== 'string' || !href.startsWith('/')) return
    done.current = true
    router.prefetch(href)
  }

  return (
    <NextLink
      ref={ref}
      href={href}
      prefetch={false}
      onMouseEnter={(e) => { warm(); onMouseEnter?.(e) }}
      onTouchStart={(e) => { warm(); onTouchStart?.(e) }}
      onFocus={(e) => { warm(); onFocus?.(e) }}
      {...rest}
    />
  )
})

export default AppLink
