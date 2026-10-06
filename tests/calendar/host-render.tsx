import type { ComponentType, ReactElement, ReactNode } from 'react'
import {
  render as renderElement,
  renderHook as renderCallback,
  type RenderOptions,
  type RenderHookOptions,
} from '@testing-library/react'
import {
  CalendarHostProvider,
  type CalendarHost,
} from '@zntr/utils/calendar-host'

export * from '@testing-library/react'

// Delegate at call time so each test's fetch stub still owns its request boundary.
const host: CalendarHost = {
  platform: 'web',
  session: { data: null, isPending: false },
  request: (...args) => globalThis.fetch(...args),
  navigation: {
    push: (path) => window.history.pushState(null, '', path),
    replace: (path) => window.history.replaceState(null, '', path),
    openExternal: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  },
}

function withHost(Wrapper?: ComponentType<{ children: ReactNode }>) {
  return function TestHost({ children }: { children: ReactNode }) {
    return (
      <CalendarHostProvider value={host}>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </CalendarHostProvider>
    )
  }
}

export function render(ui: ReactElement, options: RenderOptions = {}) {
  return renderElement(ui, { ...options, wrapper: withHost(options.wrapper) })
}

export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options: RenderHookOptions<Props> = {},
) {
  return renderCallback(callback, {
    ...options,
    wrapper: withHost(options.wrapper),
  })
}
