import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  publicClient: vi.fn(),
  consent: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams({
      client_id: 'client-1',
      scope: 'events:read events:write offline_access',
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
  mocks.publicClient.mockResolvedValue({
    data: { client_id: 'client-1', client_name: 'Trusted CLI' },
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
    expect(mocks.publicClient).toHaveBeenCalledWith({
      client_id: 'client-1',
      oauth_query: expect.stringContaining('sig=signed-query'),
    })
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
