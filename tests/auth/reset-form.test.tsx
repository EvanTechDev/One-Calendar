const { unstubAllGlobals, stubGlobal } = await import('./../support/stubs')
await import('./../support/dom')
const { fireEvent, render, screen, waitFor } =
  await import('@testing-library/react')
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
const { AuthFormProvider, ResetPasswordForm } = await import('@zntr/auth/forms')
import type { AuthFormContextValue } from '@zntr/auth/forms'

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
})

afterEach(() => {
  unstubAllGlobals()
})

describe('ResetPasswordForm recovery requests', () => {
  it('submits recovery through the instrumented auth client', async () => {
    render(
      <AuthFormProvider value={value}>
        <ResetPasswordForm />
      </AuthFormProvider>,
    )
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1))
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'ada@example.com',
      redirectTo: '/reset-password',
    })
  })

  it('does not retry a rejected request through alternate endpoints', async () => {
    requestPasswordReset.mockResolvedValueOnce({
      data: null,
      error: { message: 'Bot verification failed', status: 403 },
    } as never)
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
    stubGlobal('fetch', fetchMock)
    render(
      <AuthFormProvider value={value}>
        <ResetPasswordForm />
      </AuthFormProvider>,
    )
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send reset email/i }))

    await screen.findByText('Bot verification failed')
    expect(requestPasswordReset).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
