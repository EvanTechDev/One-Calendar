---
title: Authentication
weight: 3
---

One Calendar uses **Better Auth** for authentication, a modern auth library for Next.js.

## Features

- **Email/Password**: Standard email and password authentication with bcrypt hashing
- **Email Verification**: Verification emails sent via Resend
- **Password Reset**: Reset flow with email-based tokens
- **Two-Factor Authentication (2FA)**: Time-based OTP (TOTP) support
- **Email OTP**: One-time password for verification and password reset
- **Session Management**: Server-side session handling

## Security Features

Better Auth plugins provide additional security:

### Sentinel (Better Auth Infra)

- **Credential Stuffing Protection**: Detects and blocks credential stuffing attacks
- **Compromised Password Detection**: Alerts users if their password appears in known breaches
- **Bot Blocking**: CAPTCHA challenge for suspicious traffic
- **Email Validation**: Validates email domain and format

### Cloudflare Turnstile

CAPTCHA protection for authentication forms using Cloudflare Turnstile (privacy-first, no user interaction required).

## Client Setup

```typescript
const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
    sentinelClient({ autoSolveChallenge: true }),
  ],
})
```

## Server Setup

```typescript
const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // bcrypt hashing
  },
  plugins: [
    twoFactor({ issuer: 'One Calendar' }),
    sentinel({ apiKey: process.env.BETTER_AUTH_API_KEY, ... }),
    emailOTP({ ... }),
  ],
})
```

## API Routes

- `POST /api/auth/*` - Better Auth handles all auth routes
- `POST /api/verify` - Cloudflare Turnstile verification
