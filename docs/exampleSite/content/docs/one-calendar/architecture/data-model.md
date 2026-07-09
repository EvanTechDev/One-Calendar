---
title: Data Model
weight: 2
---

## Database Schema (PostgreSQL)

One Calendar uses Drizzle ORM with PostgreSQL. The schema is defined in `apps/calendar/lib/drizzle/schema.ts`.

### User

```typescript
{
  id: text(PK)
  name: text
  email: text(unique)
  emailVerified: boolean
  image: text(nullable)
  twoFactorEnabled: boolean(nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Session

```typescript
{
  id: text (PK)
  expiresAt: timestamp
  token: text (unique)
  createdAt: timestamp
  updatedAt: timestamp
  ipAddress: text (nullable)
  userAgent: text (nullable)
  userId: text (FK → User)
}
```

### Account

```typescript
{
  id: text (PK)
  accountId: text
  providerId: text
  userId: text (FK → User)
  accessToken: text (nullable)
  refreshToken: text (nullable)
  idToken: text (nullable)
  accessTokenExpiresAt: timestamp (nullable)
  refreshTokenExpiresAt: timestamp (nullable)
  scope: text (nullable)
  password: text (nullable)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Shares

```typescript
{
  id: serial (PK)
  userId: text (indexed)
  shareId: text (unique)
  encryptedData: text
  iv: text
  authTag: text
  timestamp: timestamp
  isProtected: boolean (default: false)
  isBurn: boolean (default: false)
  encVersion: integer (nullable)
}
```

### CalendarBackup

```typescript
{
  userId: text(PK)
  encryptedData: text
  iv: text
  timestamp: timestamp
}
```

### Verification

```typescript
{
  id: text(PK)
  identifier: text
  value: text
  expiresAt: timestamp
  createdAt: timestamp(nullable)
  updatedAt: timestamp(nullable)
}
```

### TwoFactor

```typescript
{
  id: text (PK)
  secret: text
  backupCodes: text
  verified: boolean
  userId: text (unique, FK → User)
}
```

## Local Storage Schema

Events and categories are stored in encrypted local storage:

```typescript
// Calendar event
{
  id: string
  title: string
  startDate: Date
  endDate: Date
  isAllDay: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  location?: string
  participants: string[]
  notification: number // minutes before
  description?: string
  color: string
  calendarId: string
}

// Calendar category
{
  id: string
  name: string
  color: string
  keywords?: string[]
}
```
