---
title: Vercel Deployment
weight: 2
---

One Calendar can be deployed to Vercel with one click.

## One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/EvanTechDev/One-Calendar&env=NEXT_PUBLIC_BASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,POSTGRES_URL,SALT&project-name=one-calendar&repo-name=one-calendar)

## Manual Deploy

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Import to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New → Project"
3. Import your One-Calendar repository
4. Configure environment variables

### 3. Set Environment Variables

Configure the following in Vercel dashboard:

| Variable                         | Description                     |
| -------------------------------- | ------------------------------- |
| `NEXT_PUBLIC_BASE_URL`           | Your production URL             |
| `BETTER_AUTH_SECRET`             | Random secret string            |
| `BETTER_AUTH_URL`                | Same as base URL                |
| `POSTGRES_URL`                   | PostgreSQL connection string    |
| `SALT`                           | Encryption salt                 |
| `RESEND_API_KEY`                 | For auth emails (optional)      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile (optional) |
| `TURNSTILE_SECRET_KEY`           | Cloudflare Turnstile (optional) |

### 4. Deploy

Click "Deploy". Vercel will automatically build and deploy your application.

## PostgreSQL on Vercel

Use **Neon** or **Supabase** for managed PostgreSQL:

- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Supabase](https://supabase.com) - PostgreSQL with additional services

## Post-Deploy

1. Run database migrations from your local machine:
   ```bash
   pnpm dlx drizzle-kit push
   ```
2. Configure your custom domain in Vercel dashboard
3. Set up email sending via Resend
