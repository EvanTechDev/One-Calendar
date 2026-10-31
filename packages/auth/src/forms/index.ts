/**
 * The auth forms, mounted by both apps.
 *
 * Identical in each: everything app-specific — the Better Auth client, the four
 * routes, the brand and the navigate function — arrives through
 * `AuthFormProvider` (ADR 0022).
 */
export { LoginForm } from './login-form'
export { SignUpForm } from './sign-up-form'
export { ResetPasswordForm } from './reset-form'
export { AuthLayout } from './auth-layout'
export { AuthFormProvider, useAuthForm } from './context'
export type {
  AuthFormClient,
  AuthFormRoutes,
  AuthFormBrand,
  AuthFormContextValue,
} from './context'
export type { ResetPasswordFormProps } from './reset-form'
