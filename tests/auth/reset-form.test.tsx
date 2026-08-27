// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthFormProvider,
  ResetPasswordForm,
  type AuthFormContextValue,
} from '@zntr/auth/forms'

vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: (props: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => props.onSuccess('solved-reset-token')}>
      Solve CAPTCHA
    </button>
  ),
}))

const requestPasswordReset = vi.fn(async () => ({ data: {}, error: null }))
const resetPassword = vi.fn(async () => ({ data: {}, error: null }))

const value = {
  client: {
    requestPasswordReset,
    resetPassword,
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
  },
  routes: {
    home: '/',
    signIn: '/sign-in',
    signUp: '/sign-up',
    resetPassword: '/reset-password',
  },
  brand: { appName: 'Zentra', blurb: 'Private calendar' },
  navigate: vi.fn(),
} as unknown as AuthFormContextValue

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key'
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
})

describe('ResetPasswordForm CAPTCHA contract', () => {
  it('forwards the solved token to password recovery', async () => {
    render(
      <AuthFormProvider value={value}>
        <ResetPasswordForm />
      </AuthFormProvider>,
    )
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Solve CAPTCHA' }))
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1))
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'ada@example.com',
      redirectTo: '/reset-password',
      turnstileToken: 'solved-reset-token',
    })
  })

  it('includes the token in compatible fallback requests', async () => {
    requestPasswordReset.mockResolvedValueOnce({
      data: null,
      error: { message: 'primary unavailable' },
    } as never)
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <AuthFormProvider value={value}>
        <ResetPasswordForm />
      </AuthFormProvider>,
    )
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Solve CAPTCHA' }))
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0]!
    expect(
      JSON.parse((request[1] as RequestInit).body as string),
    ).toMatchObject({
      turnstileToken: 'solved-reset-token',
    })
    vi.unstubAllGlobals()
  })
})
