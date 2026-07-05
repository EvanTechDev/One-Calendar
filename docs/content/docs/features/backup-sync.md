---
title: Backup & Sync
weight: 6
---

Keep your calendar data safe with encrypted cloud backups.

## Cloud Backup

When signed in, One Calendar can automatically back up your calendar data to the server.

### How It Works

1. Calendar data is encrypted on the client side before transmission
2. Encrypted data (ciphertext + IV) is stored in PostgreSQL
3. Only the user can decrypt their data with their local key

### Backup Status

The backup status is shown in the top navigation bar:

- **Cloud Upload icon**: Backup is enabled
- **Spinner**: Backup in progress
- **Green checkmark**: Backup successful
- **Red alert**: Backup failed

## API Endpoints

- **POST /api/blob** - Save encrypted backup
- **GET /api/blob** - Retrieve encrypted backup
- **DELETE /api/blob** - Delete backup

## Local Storage

All calendar data is stored in encrypted local storage by default:

- `calendar-events` - All calendar events
- `calendar-categories` - Calendar/category definitions
- `bookmarked-events` - Bookmarked events
- `countdowns` - Countdown timers
- Preference keys (language, timezone, theme, etc.)

Local storage encryption uses the configured `SALT` environment variable.

## Data Flow

```
User creates/edits event
        ↓
Local encrypted storage (always)
        ↓
If signed in & backup enabled:
  ↓
Client-side encryption
        ↓
POST /api/blob → PostgreSQL
```
