import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const state = vi.hoisted(() => ({
  params: new URLSearchParams(),
  response: new Response(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => state.params,
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: 'user-1', name: 'Ada', image: null } },
      isPending: false,
    }),
  },
}))

import OAuthAuthorizePage from '@/app/oauth/authorize/page'

beforeEach(() => {
  state.params = new URLSearchParams({
    response_type: 'code',
    client_id: 'client-1',
    redirect_uri: 'https://client.example/callback',
    state: 'opaque-state',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OAuth authorization callback validation', () => {
  it('does not render consent actions before validation succeeds', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    render(<OAuthAuthorizePage />)

    expect(
      screen.queryByRole('button', { name: 'Deny' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Authorize' }),
    ).not.toBeInTheDocument()
  })

  it('renders an error and never exposes denial navigation for an invalid callback', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: 'invalid_request' }, { status: 400 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<OAuthAuthorizePage />)

    await screen.findByText('Authorization Failed')
    expect(
      screen.queryByRole('button', { name: 'Deny' }),
    ).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('redirect_uri=https%3A%2F%2Fclient.example'),
    )
  })

  it('shows consent only after retaining the server-validated callback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ redirect_uri: 'https://client.example/callback' }),
      ),
    )
    render(<OAuthAuthorizePage />)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deny' })).toBeEnabled(),
    )
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeEnabled()
  })
})
