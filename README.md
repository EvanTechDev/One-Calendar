# One Calendar

> A privacy-first, weekly-focused open-source calendar built for clarity and control.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/user-attachments/assets/cb179685-f792-42c8-bad8-ef1739659906">
  <source media="(prefers-color-scheme: light)" srcset="/public/Banner.jpg">
  <img src="/public/Banner.jpg" alt="Image">
</picture>

- [Live Product](https://calendar.xyehr.cn)
- [Status](https://calendarstatus.xyehr.cn)
- [Bluesky](https://bsky.app/profile/calendar.xyehr.cn)

<a href="https://vercel.com/new/clone?repository-url=https://github.com/EvanTechDev/One-Calendar&env=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,POSTGRES_URL,SALT&project-name=one-calendar&repo-name=one-calendar" style="display: inline-block;"><img src="https://vercel.com/button" alt="Deploy with Vercel" style="height: 32px;"></a>

<a href="https://producthunt.com/product/one-calendar"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=955482&theme=light&t=1748791250175"></img></a>

## Vision

Most modern calendar tools are overloaded with automation, notifications, and analytics.  
**One Calendar** takes a different approach:

- Respect user privacy.
- Provide a smooth, local-first planning experience.
- Keep the system understandable.

This project is built for individuals and small teams who value clarity over complexity.

## Features

### Weekly planning

- **Drag & drop scheduling** &ndash; move and resize events directly on the calendar  
- **Inline editing** &ndash; create and update events without modal overload  
- **Right-click actions** &ndash; fast contextual controls for power users  
- **Keyboard-friendly interactions** &ndash; efficient navigation and editing workflows  

### Event management

- **Rich event metadata** &ndash; title, description, time range, and structured fields  
- **Precise time control** &ndash; flexible duration handling and adjustments  
- **Instant updates** &ndash; optimistic UI for a responsive experience  
- **Event persistence** &ndash; reliable storage with PostgreSQL backend  
- **Soft state handling** &ndash; controlled updates to avoid accidental data loss  

### Privacy & security

- **No AI tracking** &ndash; no behavioral profiling or data mining  
- **No analytics by default** &ndash; zero third-party tracking scripts  
- **End-to-end encryption (E2EE)** &ndash; optional encrypted data handling  
- **User-controlled exports** &ndash; backup and portability without lock-in  
- **Secure authentication** &ndash; hardened session management via Clerk  

### Sync & collaboration

- **Cloud sync (optional)** &ndash; multi-device synchronization using PostgreSQL  
- **Account-based access** &ndash; sign in with third-party providers  
- **Share-ready architecture** &ndash; designed for future team and shared calendar support  

### Customization & UX

- **Theme configuration** &ndash; adaptable visual styling  
- **Default view control** &ndash; choose how your calendar opens  
- **Locale-aware formatting** &ndash; proper date and time formatting per region  
- **Internationalization (i18n)** &ndash; language support built-in  
- **Composable UI system** &ndash; built with reusable components (shadcn/ui + Tailwind)

### Comparison with other calendar tools

| Feature                                      | One Calendar | Google Calendar | Apple Calendar | Outlook Calendar | Proton Calendar |
| -------------------------------------------- | :----------: | :-------------: | :------------: | :--------------: | :-------------: |
| Event creation & editing                     |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Drag & drop scheduling                       |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| All-day events                               |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Event reminders & notifications              |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Time zone support                            |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Calendar sharing                             |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Multiple calendar views (day/week/month)     |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Keyboard shortcuts                           |      ✅      |       ✅        |       ⚠️       |        ✅        |       ✅        |
| Search events                                |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Quick add / natural input                    |      ✅      |       ✅        |       ⚠️       |        ✅        |       ⚠️        |
| Cloud sync                                   |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Web application                              |      ✅      |       ✅        |       ⚠️       |        ✅        |       ✅        |
| End-to-end encryption (E2EE)                 |      ✅      |       ❌        |       ❌       |        ❌        |       ✅        |
| Privacy-first architecture                   |      ✅      |       ❌        |       ⚠️       |        ❌        |       ✅        |
| No analytics / tracking by default           |      ✅      |       ❌        |       ⚠️       |        ❌        |       ✅        |
| Open-source                                  |      ✅      |       ❌        |       ❌       |        ❌        |       ⚠️        |
| Self-hostable                                |      ✅      |       ❌        |       ❌       |        ❌        |       ❌        |
| Data export                                  |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| ICS import / export                          |      ✅      |       ✅        |       ✅       |        ✅        |       ✅        |
| Custom themes                                |      ✅      |       ⚠️       |       ❌       |        ⚠️        |       ⚠️        |
| Custom default view                          |      ✅      |       ⚠️       |       ❌       |        ⚠️        |       ⚠️        |

⚠️ = limited or partial support  

## Getting Started

### Prerequisites

Required Versions:

- [NodeJS](https://nodejs.org) (v20 or higher)
- [Bun](https://bun.sh) (v1.2 or higher)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar

# Install dependencies
bun install

# Start the app
bun run dev
```

Then visit `http://localhost:3000`

### Environment Variables

Copy `.env.example` to `.env` and fill in.

Key variables:

```env
# Core
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SALT=Backup-Salt

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# ATProto / Atmosphere (required for /at-oauth)
ATPROTO_SESSION_SECRET=...

# Optional DB (backup/share sync)
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar
```

## Tech Stack

- [Next.js](https://nextjs.org)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/UI](https://ui.shadcn.com)
- [PostgreSQL](https://www.postgresql.org/)
- [Clerk](https://clerk.com)

## Contributing

Contributions are welcome! Feel free to explore the project and submit improvements.

Please refer to [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and contribution guidelines.

## License

Made with ❤️

Published under [MIT License](./LICENSE).

This project is supported by [Cloudflare Project Alexandria](https://blog.cloudflare.com/expanding-our-support-for-oss-projects-with-project-alexandria/).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=EvanTechDev/One-Calendar&type=Date)](https://www.star-history.com/#EvanTechDev/One-Calendar&Date)

