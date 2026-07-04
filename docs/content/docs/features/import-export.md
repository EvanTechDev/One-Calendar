---
title: Import & Export
weight: 4
---

One Calendar supports multiple formats for data portability.

## Export Formats

### ICS (iCalendar)

Standard calendar format compatible with Google Calendar, Apple Calendar, Outlook, and more.

### JSON (One Calendar Format)

Full backup format that includes:

- Events with all properties
- Calendar categories
- Bookmarks and countdowns
- App settings (language, timezone, theme, etc.)

**Optional encryption**: Password-protect your JSON export with AES encryption.

### CSV

Simple spreadsheet format for data analysis.

## Import Formats

| Format       | File Import | URL Import |
| ------------ | :---------: | :--------: |
| ICS (.ics)   |     ✅      |     ✅     |
| JSON (.json) |     ✅      |     ✅     |
| CSV (.csv)   |     ✅      |     ❌     |

## Import Features

- **Target category**: Choose which calendar category imported events belong to
- **URL import**: Import from remote calendar URLs
- **Debug mode**: Preview parsed results before importing
- **Encrypted JSON**: Import password-protected JSON backups

## Export Features

- **Date range filtering**: Export all, future, past, last 30/90 days
- **Password encryption**: Optional AES encryption for JSON exports
- **Include completed events**: Toggle to include past events

## Tips

1. Google Calendar users: Export your calendar as ICS from Google Calendar settings, then import into One Calendar
2. JSON exports include all settings for a complete backup
3. Password-protected exports use AES-256-GCM encryption
4. Use CSV export for data analysis in spreadsheet tools
