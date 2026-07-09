---
title: API Reference
weight: 1
---

One Calendar exposes REST API endpoints for backup, sharing, and verification.

## Authentication

Most endpoints require authentication. The session is verified via Better Auth cookies.

## Share Endpoints

### Create Share

```http
POST /api/share
```

Creates a new encrypted share.

**Request Body:**

```json
{
  "id": "unique-share-id",
  "data": { "title": "Event", "startDate": "..." },
  "password": "optional-password",
  "burnAfterRead": false
}
```

**Response:**

```json
{
  "success": true,
  "id": "unique-share-id",
  "protected": false,
  "burnAfterRead": false,
  "shareLink": "/share/unique-share-id"
}
```

### Get Share

```http
GET /api/share?id=<share-id>&password=<optional>
```

Retrieves and decrypts a share.

**Response:**

```json
{
  "success": true,
  "data": "{...}",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "protected": false,
  "burnAfterRead": false
}
```

**Error Responses:**

- `401` - Password required
- `403` - Invalid password
- `404` - Share not found

### Delete Share

```http
DELETE /api/share
```

**Request Body:**

```json
{ "id": "share-id" }
```

### List Shares

```http
GET /api/share/list
```

Lists all shares for the authenticated user.

## Backup Endpoints

### Save Backup

```http
POST /api/blob
```

**Request Body:**

```json
{
  "ciphertext": "encrypted-data",
  "iv": "initialization-vector"
}
```

### Get Backup

```http
GET /api/blob
```

### Delete Backup

```http
DELETE /api/blob
```

### Check Backup (Cron)

```http
GET /api/blob/check
```

Requires `Authorization: Bearer <CRON_SECRET>` header. Returns list of database tables.

## Verification Endpoint

### Verify Turnstile Token

```http
POST /api/verify
```

**Request Body:**

```json
{
  "token": "cloudflare-turnstile-token",
  "action": "sign-in"
}
```

## Account Endpoint

### Delete Account

```http
DELETE /api/account
```

Deletes all user data (events, shares, backups) from the server.
