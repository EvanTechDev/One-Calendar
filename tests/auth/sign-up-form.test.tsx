// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuthFormProvider,
  SignUpForm,
  type AuthFormContextValue,
} from '@zntr/auth/forms'

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
})

describe('SignUpForm verification requests', () => {
  it('registers and resends through the instrumented auth client', async () => {
    render(
      <AuthFormProvider value={value}>
        <SignUpForm />
      </AuthFormProvider>,
    )
    fillSignUp()
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))
    await screen.findByText(/verification code sent/i)

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        name: 'Ada Lovelace',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /resend code/i }))

    await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledTimes(1))
    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: 'ada@example.com',
      type: 'email-verification',
    })
  })
})
