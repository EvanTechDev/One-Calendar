---
title: Self-Hosting
weight: 1
---

Deploy One Calendar on your own infrastructure.

## Requirements

- Node.js 20+
- pnpm
- PostgreSQL database (optional for full features)
- A domain name (recommended)

## Production Setup

### 1. Clone and Install

```bash
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar
pnpm install
```

### 2. Configure Environment

```bash
cp apps/calendar/.env.example apps/calendar/.env
```

Set the required variables (see [Environment Variables]({{< ref "../getting-started/environment-variables" >}})).

### 3. Database Migrations

```bash
# Generate migration files
pnpm dlx drizzle-kit generate

# Apply migrations
pnpm dlx drizzle-kit migrate
```

### 4. Build

```bash
pnpm build
```

### 5. Start

```bash
pnpm start
```

## Docker Deployment

A Dockerfile can be created using the Next.js standalone output:

```dockerfile
FROM node:20-alpine AS base
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY pnpm-lock.yaml ./
RUN corepack enable && pnpm fetch

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/calendar/.next/standalone ./
COPY --from=builder /app/apps/calendar/.next/static ./apps/calendar/.next/static
COPY --from=builder /app/apps/calendar/public ./apps/calendar/public
EXPOSE 3000
CMD ["node", "apps/calendar/server.js"]
```

## Reverse Proxy

For production, use a reverse proxy like Nginx or Caddy:

```nginx
server {
    listen 443 ssl;
    server_name calendar.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
