import { SignUpForm } from '@/components/auth/sign-up-form'

/**
 * Registration. The only one in the suite (ADR 0021).
 *
 * The return target is read by the form from the query string and passed
 * through to sign-in, not navigated to — a freshly-registered user still has to
 * verify and sign in, and it is sign-in that resolves the target against
 * registered clients.
 */
export default function SignUpPage() {
  return <SignUpForm />
}
