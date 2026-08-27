// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthFormProvider,
  SignUpForm,
  type AuthFormContextValue,
} from '@zntr/auth/forms'

let solvedToken = 'initial-signup-token'
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: (props: { onSuccess: (token: string) => void }) => (
    <button type="button" onClick={() => props.onSuccess(solvedToken)}>
      Solve CAPTCHA
    </button>
  ),
}))

const signUp = vi.fn(async () => ({ data: {}, error: null }))
const sendVerificationOtp = vi.fn(async () => ({ data: {}, error: null }))

const value = {
  client: {
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    signIn: { email: vi.fn() },
    signUp: { email: signUp },
    emailOtp: {
      sendVerificationOtp,
      verifyEmail: vi.fn(),
    },
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

function fillSignUp() {
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: 'Ada' },
  })
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: 'Lovelace' },
  })
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'ada@example.com' },
  })
  fireEvent.change(screen.getByLabelText(/^password/i), {
    target: { value: 'correct horse battery staple' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key'
  solvedToken = 'initial-signup-token'
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
})

describe('SignUpForm CAPTCHA contract', () => {
  it('forwards a fresh solved token when resending verification email', async () => {
    render(
      <AuthFormProvider value={value}>
        <SignUpForm />
      </AuthFormProvider>,
    )
    fillSignUp()
    fireEvent.click(screen.getByRole('button', { name: 'Solve CAPTCHA' }))
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
    await screen.findByText(/verification code sent/i)

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ turnstileToken: 'initial-signup-token' }),
    )

    solvedToken = 'fresh-resend-token'
    fireEvent.click(screen.getByRole('button', { name: 'Solve CAPTCHA' }))
    fireEvent.click(screen.getByRole('button', { name: /resend code/i }))

    await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledTimes(1))
    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      type: 'email-verification',
      turnstileToken: 'fresh-resend-token',
    })
  })
})
