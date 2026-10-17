import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { translations } from '@zntr/i18n/calendar'
import { PaletteSearchResults } from '@zntr/ui/calendar/components/app/ai/palette-search-results'

vi.mock('@zntr/ui/command', () => ({
  CommandGroup: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  CommandItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CommandList: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}))

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
