---
title: Environment Variables
weight: 2
---

Copy `.env.example` to `.env` and fill in the required values.

## Core Variables

```env
# The base URL of your application
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Salt used for encrypted local storage backup
SALT=Backup-Salt
```

## Authentication

```env
# Better Auth secret key (generate a random string)
BETTER_AUTH_SECRET=your-secret-key

# Better Auth URL (same as base URL)
BETTER_AUTH_URL=http://localhost:3000

# Optional: Better Auth API key for security features
BETTER_AUTH_API_KEY=your-api-key
```

## Database (Optional)

Required for cloud sync and persistence features:

```env
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar
```

## CAPTCHA (Optional)

Cloudflare Turnstile integration:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=site-key
TURNSTILE_SECRET_KEY=secret-key
```

## Email (Optional)

For sending verification emails and password resets via Resend:

```env
RESEND_API_KEY=re_xxx
RESEND_SENDER_EMAIL=no-reply@yourdomain.com
```
