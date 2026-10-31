'use client'

import type { ComponentProps } from 'react'

export function LandingAnchor(props: ComponentProps<'a'>) {
  return (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !props.href?.startsWith('#')
        )
          return

        const target = document.getElementById(props.href.slice(1))
        if (!target) return
        event.preventDefault()
        window.history.pushState(window.history.state, '', props.href)
        target.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'instant'
            : 'smooth',
          block: 'start',
        })
        target.focus({ preventScroll: true })
      }}
    />
  )
}
