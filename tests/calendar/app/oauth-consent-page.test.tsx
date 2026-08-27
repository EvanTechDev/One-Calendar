import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  publicClient: vi.fn(),
  consent: vi.fn(),
}))

const query = vi.hoisted(() => ({
  scope: 'events:read events:write offline_access',
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams({
      client_id: 'client-1',
      scope: query.scope,
      resource: 'https://calendar.example/api/mcp',
      sig: 'signed-query',
      exp: '9999999999',
    }),
}))

vi.mock('@/lib/auth/oauth-client', () => ({
  oauthAuthClient: {
    useSession: () => ({
      data: { user: { name: 'Ada', image: null } },
      isPending: false,
    }),
    oauth2: {
      publicClientPrelogin: mocks.publicClient,
      consent: mocks.consent,
    },
  },
}))

import OAuthConsentPage from '@/app/oauth/consent/page'

beforeEach(() => {
  vi.clearAllMocks()
  query.scope = 'events:read events:write offline_access'
  mocks.publicClient.mockResolvedValue({
    data: {
      client_id: 'https://linear.app/oauth/client.json',
      client_name: 'Trusted CLI',
      client_uri: 'https://linear.app',
    },
    error: null,
  })
  mocks.consent.mockResolvedValue({
    data: null,
    error: { message: 'stop before navigation' },
  })
})

describe('OAuth consent page', () => {
  it('shows actions only after validating the signed client request', async () => {
    render(<OAuthConsentPage />)

    expect(screen.queryByRole('button', { name: 'Authorize' })).toBeNull()
    await screen.findByText(/Trusted CLI wants access to your calendar/)
    expect(screen.getByRole('button', { name: 'Authorize' })).toBeEnabled()
    expect(screen.getByText(/calendar\.example\/api\/mcp/)).toBeInTheDocument()
    expect(screen.getByText('Events')).toBeInTheDocument()
    expect(screen.getByText('READ+WRITE')).toBeInTheDocument()
    expect(screen.getByText('Offline access')).toBeInTheDocument()
    expect(screen.getByText('LONG-LIVED')).toBeInTheDocument()
    expect(screen.getByText('Client origin: linear.app')).toBeInTheDocument()
    expect(mocks.publicClient).toHaveBeenCalledWith({
      client_id: 'client-1',
      oauth_query: expect.stringContaining('sig=signed-query'),
    })
  })

  it('discloses a write-only scope instead of silently hiding it', async () => {
    query.scope = 'events:write'
    render(<OAuthConsentPage />)

    await screen.findByText('Events')
    expect(screen.getByText('WRITE')).toBeInTheDocument()
    expect(screen.queryByText('READ+WRITE')).toBeNull()
  })

  it('returns the complete signed query to Better Auth on consent', async () => {
    render(<OAuthConsentPage />)
    await screen.findByText(/Trusted CLI wants access to your calendar/)

    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))

    await waitFor(() => expect(mocks.consent).toHaveBeenCalledTimes(1))
    expect(mocks.consent).toHaveBeenCalledWith({
      accept: true,
      oauth_query: expect.stringMatching(
        /client_id=client-1.*sig=signed-query/,
      ),
    })
  })

  it('never renders consent actions when signed query validation fails', async () => {
    mocks.publicClient.mockResolvedValue({
      data: null,
      error: { message: 'invalid signature' },
    })
    render(<OAuthConsentPage />)

    await screen.findByText('Authorization unavailable')
    expect(screen.queryByRole('button', { name: 'Authorize' })).toBeNull()
  })
})
