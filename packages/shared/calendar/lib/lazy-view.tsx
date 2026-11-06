'use client'

import { lazy, Suspense, useState, type ComponentType } from 'react'

/** Keep the same lazy boundaries in every calendar host. */
export default function lazyView<P extends object>(
  load: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options: { loading?: ComponentType } = {},
) {
  let resolved: ComponentType<P> | undefined
  let pending: Promise<{ default: ComponentType<P> }> | undefined
  const preload = () => {
    pending ??= load().then((module) => {
      const normalized =
        typeof module === 'function'
          ? { default: module }
          : (module as { default: ComponentType<P> })
      resolved = normalized.default
      return normalized
    })
    return pending
  }
  const View = lazy(preload)
  const Loading = options.loading
  function LazyView(props: P) {
    // Snapshot once: switching from lazy to resolved after mount would remount
    // the child and discard draft state. Preloaded first mounts never suspend.
    const [InitialView] = useState(() => resolved ?? View)
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <InitialView {...props} />
      </Suspense>
    )
  }
  LazyView.preload = preload
  return LazyView
}
