// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import {
  LoginForm,
  SignUpForm,
  ResetPasswordForm,
  AuthFormProvider,
  type AuthFormClient,
  type AuthFormContextValue,
} from '@zntr/auth/forms'

/**
 * The shared auth forms.
 *
 * Both apps mount these. What makes that possible is that everything
 * app-specific — the Better Auth client, the four routes, navigation — arrives
 * through the provider (ADR 0022).
 *
 * These pin the contract that keeps two mounts identical: who gets called with
 * what, and which destination each app lands on. Not the markup — jsdom has no
 * layout engine and a test that pretends to measure pixels is worse than none.
 */
const signInEmail = vi.fn(async () => ({
  data: { user: { id: 'u1' } },
  error: null,
}))
const signUpEmail = vi.fn(async () => ({
  data: { user: { id: 'u1' } },
  error: null,
}))
const requestPasswordReset = vi.fn(async () => ({ data: {}, error: null }))
const resetPassword = vi.fn(async () => ({ data: {}, error: null }))
const sendVerificationOtp = vi.fn(async () => ({ data: {}, error: null }))
const verifyEmail = vi.fn(async () => ({ data: {}, error: null }))
const navigate = vi.fn()

const client = () =>
  ({
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
    requestPasswordReset,
    resetPassword,
    emailOtp: { sendVerificationOtp, verifyEmail },
  }) as unknown as AuthFormClient

const context = (
  routes?: Partial<AuthFormContextValue['routes']>,
): AuthFormContextValue => ({
  client: client(),
  navigate,
  brand: { appName: 'Zentra Meet', blurb: 'Meetings, privately.' },
  routes: {
    home: '/dashboard',
    signIn: '/sign-in',
    signUp: '/sign-up',
    resetPassword: '/reset-password',
    ...routes,
  },
})

const mount = (
  ui: React.ReactNode,
  routes?: Partial<AuthFormContextValue['routes']>,
) => render(<AuthFormProvider value={context(routes)}>{ui}</AuthFormProvider>)

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
})

describe('the provider', () => {
  it('refuses to render a form without one', () => {
    // Throws rather than defaulting: a default client would look like a working
    // form that authenticates against the wrong origin.
    expect(() => render(<LoginForm />)).toThrow(/AuthFormProvider/)
  })
})

describe('LoginForm', () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'hunter22' },
    })
  }

  it('signs in with what the user typed', async () => {
    mount(<LoginForm />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(1))
    const arg = signInEmail.mock.calls[0][0] as Record<string, unknown>
    expect(arg.email).toBe('a@example.com')
    expect(arg.password).toBe('hunter22')
  })

  it('lands on the mounting app\u2019s home, not a hard-coded /app', async () => {
    // The whole point of routes.home. meet has no /app, so a literal would send
    // its users to a 404 immediately after a successful sign-in.
    mount(<LoginForm />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('prefers an explicit returnTo over the app home', async () => {
    mount(<LoginForm returnTo="/app/settings" />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/settings'))
  })

  it('uses a full page load for an absolute returnTo', async () => {
    // returnTo may point at the sibling app, which the router cannot reach.
    // Already allowlisted server-side before it gets here.
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign },
      writable: true,
    })
    mount(<LoginForm returnTo="https://meettest.xyehr.cn/dashboard" />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://meettest.xyehr.cn/dashboard',
      ),
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not navigate when sign-in fails', async () => {
    signInEmail.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid email or password' },
    } as never)
    mount(<LoginForm />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(signInEmail).toHaveBeenCalled())
    expect(navigate).not.toHaveBeenCalled()
  })

  it('links to the mounting app\u2019s own sign-up and recovery routes', () => {
    mount(<LoginForm />, {
      signUp: '/join',
      resetPassword: '/forgot',
    })
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    )
    expect(hrefs).toContain('/join')
    expect(hrefs).toContain('/forgot')
  })

  it('omits the CAPTCHA widget when no site key is configured', () => {
    // The server half fails open to match. A widget with no key is a challenge
    // that can never be solved.
    mount(<LoginForm />)
    expect(document.querySelector('iframe')).toBeNull()
  })
})

describe('SignUpForm', () => {
  const fill = () => {
    const first = screen.queryByLabelText(/first name/i)
    if (first) fireEvent.change(first, { target: { value: 'Ada' } })
    const last = screen.queryByLabelText(/last name/i)
    if (last) fireEvent.change(last, { target: { value: 'Lovelace' } })
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'hunter22' },
    })
  }

  it('registers, then asks for the emailed code', async () => {
    // Account first, verification second. Which order this runs in is a real
    // decision — an unverified row exists in between — and the test pins the
    // order the app actually implements rather than the one it might have.
    mount(<SignUpForm />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign up|create/i }))

    await waitFor(() => expect(signUpEmail).toHaveBeenCalledTimes(1))
    const arg = signUpEmail.mock.calls[0][0] as Record<string, unknown>
    expect(arg.email).toBe('ada@example.com')
    expect(arg.name).toBe('Ada Lovelace')
  })

  it('points the emailed callback at the mounting app, not the calendar', async () => {
    // callbackURL is where Better Auth sends the user after they follow the link.
    // A hard-coded /app would drop meet's new users on a route it does not have.
    mount(<SignUpForm />)
    fill()
    fireEvent.click(screen.getByRole('button', { name: /sign up|create/i }))

    await waitFor(() => expect(signUpEmail).toHaveBeenCalled())
    const arg = signUpEmail.mock.calls[0][0] as Record<string, unknown>
    expect(arg.callbackURL).toBe('/dashboard')
  })
})

describe('ResetPasswordForm', () => {
  it('asks for a code when it has no token', async () => {
    mount(<ResetPasswordForm />)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /send|continue|reset|request/i }),
    )

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1))
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({ redirectTo: '/reset-password' }),
    )
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('preserves an OAuth continuation in the reset callback', async () => {
    mount(<ResetPasswordForm />, {
      resetPassword: '/oauth/reset-password?sig=signed-query',
    })
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'a@example.com' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /send|continue|reset|request/i }),
    )

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1))
    expect(requestPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectTo: '/oauth/reset-password?sig=signed-query',
      }),
    )
  })

  it('sets a new password when it has one', async () => {
    // The token comes from the page, not from a useSearchParams call inside the
    // component — that hook has no meaning outside a Next app router.
    mount(<ResetPasswordForm token="tok_123" />)
    const fields = screen.getAllByLabelText(/password/i)
    for (const field of fields) {
      fireEvent.change(field, { target: { value: 'newpassword22' } })
    }
    fireEvent.click(
      screen.getByRole('button', { name: /reset|save|update|set/i }),
    )

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1))
    const arg = resetPassword.mock.calls[0][0] as Record<string, unknown>
    expect(arg.token).toBe('tok_123')
  })
})
