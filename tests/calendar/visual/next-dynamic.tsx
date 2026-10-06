import { lazy, Suspense, type ComponentType } from 'react'

// The fixture supplies a browser-only host for Next's lazy component boundary.
// Components, data providers, and the calendar application remain the real ones.
export default function dynamic<P extends object>(
  load: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
) {
  const Component = lazy(async () => {
    const loaded = await load()
    return { default: typeof loaded === 'function' ? loaded : loaded.default }
  })
  return function Deferred(props: P) {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    )
  }
}
