# Context

## Glossary

### New User
A user within their first session after email verification. Distinct from:
- **Unverified User** — signed up but hasn't verified email yet
- **Returning User** — has previously logged in before

### Welcome Flow
Two distinct touchpoints triggered at different moments:
1. **Welcome Email** — sent via Better Auth `after` hook when `emailVerified` flips to `true`. Server-side (not frontend-triggered). Hardcoded English.
2. **Welcome Dialog** — shown once after the user's first sign-in, when the `/app` loading component finishes mounting. Presence determined by `onboardingCompleted` field in the Better Auth session (via `additionalFields`), no extra API call needed. Content: brand welcome + feature highlights + quick start steps + CTA button (closes dialog, stays on /app). Dismissal (close button, backdrop click, or CTA click) calls `POST /api/account/onboarding-complete` to flip `user.onboardingCompleted` to `true`. Never shows again after that. Hardcoded English.

