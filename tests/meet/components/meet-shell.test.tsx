import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  render,
  cleanup,
  screen,
  within,
  fireEvent,
} from '@testing-library/react'
import { MeetShell } from '@/components/shell/meet-shell'

function renderShell(overrides?: {
  section?: 'home' | 'upcoming' | 'history'
  onSectionChange?: (section: 'home' | 'upcoming' | 'history') => void
  onNewMeeting?: () => void
}) {
  const onSectionChange = overrides?.onSectionChange ?? vi.fn()
  const onNewMeeting = overrides?.onNewMeeting ?? vi.fn()
  const { container } = render(
    <MeetShell
      section={overrides?.section ?? 'home'}
      onSectionChange={onSectionChange}
      onNewMeeting={onNewMeeting}
      identity={<span>Ada Lovelace</span>}
    >
      <p>section content</p>
    </MeetShell>,
  )
  return { container, onSectionChange, onNewMeeting }
}

describe('MeetShell', () => {
  beforeEach(cleanup)

  it('mirrors the calendar shell: h-dvh, a 247px bordered rail, an h-16 header', () => {
    const { container } = renderShell()
    const shell = container.firstElementChild as HTMLElement
    expect(shell.className).toContain('h-dvh')
    expect(shell.className).toContain('bg-background')
    expect(shell.className).toContain('overflow-hidden')

    const rail = container.querySelector('aside')!
    expect(rail.className).toContain('w-[247px]')
    expect(rail.className).toContain('border-r')
    expect(rail.className).toContain('bg-background')

    const header = container.querySelector('header')!
    expect(header.className).toContain('h-16')
    expect(header.className).toContain('border-b')
    expect(header.className).toContain('px-4')
  })

  it('uses seams rather than floating rounded panels', () => {
    // The calendar's shell is one bg-background with borders; a rounded panel
    // here would read as a different product (CONTEXT.md: Shell vs Panel).
    const { container } = renderShell()
    const shell = container.firstElementChild as HTMLElement
    expect(shell.className).not.toMatch(/rounded/)
    expect(container.querySelector('aside')!.className).not.toMatch(/rounded-/)
  })

  it('keeps the static rail desktop-only and puts a Sheet trigger below sm', () => {
    const { container } = renderShell()
    const rail = container.querySelector('aside')!
    expect(rail.className).toContain('hidden')
    expect(rail.className).toContain('sm:flex')
    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    expect(trigger.className).toContain('sm:hidden')
  })

  it('marks the active nav item and leaves the others idle', () => {
    const { container } = renderShell({ section: 'upcoming' })
    const nav = container.querySelector('nav')!
    const active = within(nav).getByRole('button', { name: 'Upcoming' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active.className).toContain('bg-accent')
    expect(active.className).toContain('text-accent-foreground')

    const idle = within(nav).getByRole('button', { name: 'Home' })
    expect(idle).not.toHaveAttribute('aria-current')
    expect(idle.className).toContain('text-muted-foreground')
    expect(idle.className).toContain('hover:bg-muted')
  })

  it('reports the section the user picks', () => {
    const { container, onSectionChange } = renderShell()
    const nav = container.querySelector('nav')!
    fireEvent.click(within(nav).getByRole('button', { name: 'Your meetings' }))
    expect(onSectionChange).toHaveBeenCalledWith('history')
  })

  it('offers the primary action in the sidebar', () => {
    const { onNewMeeting } = renderShell()
    const button = screen.getByRole('button', { name: /New meeting/ })
    expect(button.className).toContain('h-10')
    expect(button.className).toContain('w-full')
    fireEvent.click(button)
    expect(onNewMeeting).toHaveBeenCalledOnce()
  })

  it('names the active section in the header and shows the identity', () => {
    renderShell({ section: 'history' })
    const header = screen.getByRole('banner')
    expect(header).toHaveTextContent('Your meetings')
    expect(header).toHaveTextContent('Ada Lovelace')
  })

  it('renders its children as the main column', () => {
    renderShell()
    expect(screen.getByRole('main')).toHaveTextContent('section content')
  })

  it('opens the mobile Sheet with the same nav as the rail', async () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    // Both the rail and the sheet render the nav, so every label doubles —
    // that duplication IS the shared SidebarBody.
    const dialog = await screen.findByRole('dialog')
    for (const label of ['Home', 'Upcoming', 'Your meetings']) {
      expect(within(dialog).getByRole('button', { name: label })).toBeTruthy()
    }
  })
})
