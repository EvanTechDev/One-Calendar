import { mock as moduleMock } from 'bun:test'
await import('./../../support/dom')
const { default: React } = await import('react')
import { afterEach, expect, it, vi } from 'bun:test'
const { cleanup, render, screen } = await import('@testing-library/react')

moduleMock.module('@zntr/ui/command', () => ({
  CommandGroup: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  CommandItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CommandList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))
const { translations } = await import('@zntr/i18n/calendar')

const { PaletteSearchResults } =
  await import('@zntr/calendar/components/ai/palette-search-results')

afterEach(cleanup)

const common = {
  t: translations.en,
  hits: [],
  total: 0,
  onSelect: vi.fn(),
  formatWhen: () => '',
}

it('gives the idle search state a clear visual prompt', () => {
  const { container } = render(
    <PaletteSearchResults {...common} status="idle" />,
  )

  expect(
    screen.getByText(translations.en.commandPaletteSearchPlaceholder),
  ).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeInTheDocument()
})

it('explains an empty result and how to broaden the search', () => {
  const { container } = render(
    <PaletteSearchResults {...common} status="ready" />,
  )

  expect(screen.getByText(translations.en.noMatchingEvents)).toBeInTheDocument()
  expect(
    screen.getByText(translations.en.commandPaletteSearchPlaceholder),
  ).toBeInTheDocument()
  expect(container.querySelector('svg')).toBeInTheDocument()
})
