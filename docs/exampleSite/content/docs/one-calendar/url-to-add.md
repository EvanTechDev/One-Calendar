---
linkTitle: "URL to add event"
title: How to use URL to add event
---

This document will help you how to add one or more event using url

Format: `?events=title, startTime, endTime, description, location, color,  participants`

## Supported parameters

- `title` or `name`: Event title (required)
- `date` or `startDate`: Start date (default is tomorrow)
- `endDate`: End date (default is 1 hour after the start time)
- `description`: Event description
- `location`: Event location
- `participants`: Participants
- `color`: Event color (optional values: blue, green, red, yellow, purple, pink, indigo, orange, teal)

## Date format

Supports the following date formats:

- `yyyy.mm.dd.hh.minute`: e.g. `2024.03.25.14.30` means March 25, 2024, 14:3
- Relative time:
  - `1h`: 1 hour later
  - `2.5h`: 2.5 hours later
  - `30m`: 30 minutes later
  - `1d2:00`: 2 o'clock tomorrow
  - `2d`: 2 days later
  - `1d3h30m`: 1 day, 3 hours and 30 minutes later

## Example

```
https://calendar.xyehr.cn/app?events=Name,1d9:00,1d11:30,Description,Home(Location),yellow,Evan
```

If you need to skip some optional items, you need to leave this blank.

For example(I don't want to add Description and location ):

```
https://calendar.xyehr.cn/app?events=Name,1d9:00,1d11:30,,,yellow,Evan
```
