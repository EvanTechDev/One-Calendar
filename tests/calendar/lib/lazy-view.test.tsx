await import('./../../support/dom')
const { act, cleanup, fireEvent, render, screen } =
  await import('@testing-library/react')
import { afterEach, expect, it, vi } from 'bun:test'
const { default: lazyView } = await import('@zntr/ui/calendar/lib/lazy-view')

afterEach(cleanup)

it('shows loading while unresolved and preserves edits on parent rerenders', async () => {
  const Editor = () => <input aria-label="draft" defaultValue="" />
  let resolve!: (module: { default: typeof Editor }) => void
  const load = vi.fn(
    () =>
      new Promise<{ default: typeof Editor }>((done) => {
        resolve = done
      }),
  )
  const View = lazyView(load, {
    loading: () => <div role="status">Loading</div>,
  })
  const { rerender } = render(<View />)
  expect(screen.getByRole('status')).toBeInTheDocument()
  await act(async () => resolve({ default: Editor }))
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'unsaved' },
  })
  rerender(<View />)
  expect(screen.getByRole('textbox')).toHaveValue('unsaved')
  expect(load).toHaveBeenCalledTimes(1)
})

it('renders an awaited preload immediately without a loading flash or another import', async () => {
  const Loading = vi.fn(() => <div role="status">Loading</div>)
  const load = vi.fn(async () => () => <div>Ready</div>)
  const View = lazyView(load, { loading: Loading })
  await Promise.all([View.preload(), View.preload()])
  render(<View />)
  expect(screen.getByText('Ready')).toBeInTheDocument()
  expect(Loading).not.toHaveBeenCalled()
  expect(load).toHaveBeenCalledTimes(1)
})
