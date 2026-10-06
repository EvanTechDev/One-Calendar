'use client'

import { lazy, Suspense, type ComponentType } from 'react'

/** Keep the same lazy boundaries in every calendar host. */
export default function lazyView<P extends object>(
  load: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
) {
  const View = lazy(async () => {
    const module = await load()
    return typeof module === 'function'
      ? { default: module }
      : (module as { default: ComponentType<P> })
  })
  return function LazyView(props: P) {
    return (
      <Suspense fallback={null}>
        <View {...props} />
      </Suspense>
    )
  }
}
