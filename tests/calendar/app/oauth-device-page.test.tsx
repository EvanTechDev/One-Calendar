import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  signedIn: false,
}))

const mocks = vi.hoisted(() => ({
  device: Object.assign(vi.fn(), {
    approve: vi.fn(),
    deny: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ user_code: 'ABCD1234' }),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({
      data: state.signedIn ? { user: { id: 'user-1' } } : null,
      isPending: false,
    }),
    device: mocks.device,
  },
}))

import OAuthDevicePage from '@/app/oauth/device/page'

beforeEach(() => {
  state.signedIn = false
  vi.clearAllMocks()
  mocks.device.mockResolvedValue({
    data: {
      client_id: 'client-1',
      scope: 'events:read',
      resource: 'https://calendar.example/api/mcp',
    },
    error: null,
  })
})

describe('OAuth device page', () => {
  it('preserves the device code through ordinary sign-in', () => {
    render(<OAuthDevicePage />)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      expect.stringContaining(
        'redirect=%2Foauth%2Fdevice%3Fuser_code%3DABCD1234',
      ),
    )
  })

  it('loads the device request only for a signed-in user', async () => {
    state.signedIn = true
    render(<OAuthDevicePage />)

    await screen.findByText('client-1')
    expect(mocks.device).toHaveBeenCalledWith({
      query: { user_code: 'ABCD1234' },
    })
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Deny' })).toBeEnabled()
    expect(screen.getByText(/calendar\.example\/api\/mcp/)).toBeInTheDocument()
  })
})
