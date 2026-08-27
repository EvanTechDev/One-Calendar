import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams(
      'client_id=https%3A%2F%2Fclient.example%2Fmetadata.json' +
        '&sig=signed-query&exp=9999999999&token=reset-secret' +
        '&ba_param=client_id&ba_param=exp&ba_param=ba_param',
    ),
}))

vi.mock('@/lib/auth/oauth-client', () => ({
  oauthAuthClient: {
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    emailOtp: {
      sendVerificationOtp: vi.fn(),
      verifyEmail: vi.fn(),
    },
  },
}))

import { OAuthAuthFormHost } from '@/components/auth/oauth-auth-form-host'

describe('OAuth auth form continuation', () => {
  it('preserves the signed query across sign-up and recovery links', () => {
    render(<OAuthAuthFormHost form="login" />)

    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      expect.stringMatching(
        /^\/oauth\/sign-up\?.*client_id=.*&.*sig=signed-query/,
      ),
    )
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', expect.stringContaining('/oauth/reset-password?'))
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).not.toHaveAttribute('href', expect.stringContaining('reset-secret'))
  })

  it('returns verified sign-ups to the signed OAuth login request', () => {
    render(<OAuthAuthFormHost form="sign-up" />)

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      expect.stringContaining('/oauth/sign-in?'),
    )
  })
})
