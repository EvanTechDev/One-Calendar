import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'

/**
 * The dashboard settings dialog: section switching, and that a preference
 * toggled here is persisted where the join path will read it.
 *
 * next-themes is faked so the theme row can be asserted without a provider —
 * the real one needs `matchMedia`, which jsdom does not supply.
 *
 * next/navigation is faked because the account section now mounts the shared
 * panel from @zntr/auth (ADR 0022), whose host reads the router to navigate after
 * sign-out.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

// The shared account panel reads the session from the client rather than taking
// it as a prop, which is what lets it render under either app's client.
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: 'u1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          image: null,
          emailVerified: true,
        },
      },
    }),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ data: {}, error: null })),
    $store: { atoms: { session: { get: () => ({ refetch: async () => {} }) } } },
  },
}))

const theme = { value: 'system', setTheme: vi.fn() }
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}))

const { SettingsDialog } =
  await import('@/components/dashboard/settings-dialog')
const { loadUserChoices } = await import('@/lib/user-choices')

const user = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
}

function open(overrides?: { onSignOut?: () => void }) {
  const onOpenChange = vi.fn()
  const onSignOut = overrides?.onSignOut ?? vi.fn()
  const view = render(
    <SettingsDialog
      open
      onOpenChange={onOpenChange}
      user={user}
      calendarOrigin="https://cal.example.com"
      onSignOut={onSignOut}
    />,
  )
  return { ...view, onOpenChange, onSignOut }
}

/** The aside's nav, which is duplicated nowhere — unlike the shell's. */
function sectionNav() {
  return screen.getByRole('navigation', { name: 'Settings' })
}

/** All three panels stay mounted; only `hidden` distinguishes them. */
function panelFor(section: 'preferences' | 'account' | 'about'): HTMLElement {
  return document.querySelector(`[data-section="${section}"]`) as HTMLElement
}

beforeEach(() => {
  localStorage.clear()
  theme.value = 'system'
  theme.setTheme.mockClear()
})

afterEach(cleanup)

describe('dashboard SettingsDialog', () => {
  it('mirrors the calendar dialog: 3xl padding-less content, 86vh body, w-56 aside', () => {
    open()
    const content = document.querySelector('[data-slot="dialog-content"]')!
    expect(content.className).toContain('sm:max-w-3xl')
    expect(content.className).toContain('p-0')
    expect(content.className).toContain('max-w-[calc(100vw-1rem)]')

    const body = content.firstElementChild as HTMLElement
    expect(body.className).toContain('h-[min(86vh,46rem)]')
    expect(body.className).toContain('flex-col')
    expect(body.className).toContain('sm:flex-row')

    const aside = content.querySelector('aside')!
    expect(aside.className).toContain('sm:w-56')
    expect(aside.className).toContain('sm:border-r')
  })

  it('lines the aside title strip up with the content header at h-14', () => {
    open()
    const content = document.querySelector('[data-slot="dialog-content"]')!
    const strip = content.querySelector('aside > div')!
    expect(strip.className).toContain('h-14')
    expect(content.querySelector('header')!.className).toContain('h-14')
  })

  it('replaces the default close button with the header X', () => {
    open()
    const content = document.querySelector('[data-slot="dialog-content"]')!
    // showCloseButton={false} — the radix Close button must not be rendered.
    expect(content.querySelectorAll('[data-slot="dialog-close"]').length).toBe(
      0,
    )
    expect(
      within(content.querySelector('header')!).getByRole('button', {
        name: 'Close',
      }),
    ).toBeTruthy()
  })

  it('closes from the header X', () => {
    const { onOpenChange } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens on Preferences and marks it current', () => {
    open()
    const active = within(sectionNav()).getByRole('button', {
      name: 'Preferences',
    })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active.className).toContain('bg-accent')
    expect(panelFor('preferences')).not.toHaveAttribute('hidden')
  })

  it('switches sections by toggling hidden, keeping all three mounted', () => {
    open()
    fireEvent.click(within(sectionNav()).getByRole('button', { name: 'About' }))

    expect(panelFor('about')).not.toHaveAttribute('hidden')
    // Preferences is still in the tree, just hidden — the calendar's pattern,
    // so switching section never remounts anything.
    expect(panelFor('preferences')).toHaveAttribute('hidden')
    expect(screen.getByLabelText('Camera on')).toBeTruthy()

    const idle = within(sectionNav()).getByRole('button', {
      name: 'Preferences',
    })
    expect(idle).not.toHaveAttribute('aria-current')
    expect(idle.className).toContain('text-muted-foreground')
  })

  it('names the active section in the content header', () => {
    open()
    fireEvent.click(
      within(sectionNav()).getByRole('button', { name: 'Account' }),
    )
    const header = document
      .querySelector('[data-slot="dialog-content"]')!
      .querySelector('header')!
    expect(header).toHaveTextContent('Account')
  })

  it('offers exactly Preferences, Account, and About', () => {
    open()
    const labels = within(sectionNav())
      .getAllByRole('button')
      .map((node) => node.textContent)
    expect(labels).toEqual(['Preferences', 'Account', 'About'])
  })

  it('persists join-muted where the join path reads it', async () => {
    open()
    fireEvent.click(screen.getByLabelText('Microphone on'))
    await waitFor(() => expect(loadUserChoices().audioEnabled).toBe(false))
    // Untouched fields keep their defaults — a merging write, not a replace.
    expect(loadUserChoices().videoEnabled).toBe(true)
  })

  it('persists camera-off and the noise filter choice independently', async () => {
    open()
    fireEvent.click(screen.getByLabelText('Camera on'))
    fireEvent.click(screen.getByLabelText('Noise cancellation'))
    await waitFor(() => {
      const stored = loadUserChoices()
      expect(stored.videoEnabled).toBe(false)
      expect(stored.noiseFilterEnabled).toBe(true)
    })
  })

  it('reflects what is already stored rather than the defaults', async () => {
    localStorage.setItem(
      'zentra-meet-user-choices',
      JSON.stringify({ audioEnabled: false, noiseFilterEnabled: true }),
    )
    open()
    await waitFor(() =>
      expect(screen.getByLabelText('Microphone on')).toHaveAttribute(
        'data-state',
        'unchecked',
      ),
    )
    expect(screen.getByLabelText('Noise cancellation')).toHaveAttribute(
      'data-state',
      'checked',
    )
  })

  it('routes theme through next-themes rather than a second mechanism', () => {
    open()
    // The trigger shows the current value, proving it reads the provider.
    expect(screen.getByRole('combobox', { name: /Theme/i })).toHaveTextContent(
      'System',
    )
  })

  it('mounts the shared account panel rather than a link to the calendar', () => {
    // This used to assert the opposite — a card linking out, and NO form —
    // because meet's auth route exposed no account mutation and every change had
    // to happen where the CAPTCHA and audit logging lived. Both moved into
    // @zntr/auth, so meet performs them itself now (ADR 0022).
    open()
    fireEvent.click(
      within(sectionNav()).getByRole('button', { name: 'Account' }),
    )
    const account = panelFor('account')
    // An editable field is the point: the panel is real, not a redirect.
    expect(within(account).queryAllByRole('textbox').length).toBeGreaterThan(0)
    expect(
      within(account).queryByRole('link', { name: /Open calendar/ }),
    ).toBeNull()
  })

  it('reports build facts on About without inventing any', () => {
    open()
    fireEvent.click(within(sectionNav()).getByRole('button', { name: 'About' }))
    const about = panelFor('about')
    expect(about).toHaveTextContent('Version')
    expect(about).toHaveTextContent('Commit')
  })
})
