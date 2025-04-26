<div align="center">
  <img src="public/icon.svg" width="72">
</div>

# One Calendar

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Dev-Huang1/One-Calendar&env=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,OPENWEATHER_API_KEY,BLOB_READ_WRITE_TOKEN&project-name=one-calendar&repo-name=one-calendar)

A beautifully minimal open-source calendar app to plan your week and life.

## What is One Calendar?

**One Calendar** is a privacy-first, weekly-focused, open-source calendar app, designed to help individuals and teams plan, focus, and stay in sync.

> Without *One Calendar*, your schedule is scattered. With it, your week feels intentional.

## Why One Calendar?

Most calendar tools are cluttered, over-engineered, or locked behind paywalls. One Calendar aims to be:

- 🧠 **Simple and Intuitive** – Weekly view first, with minimal distractions.
- 🕹 **Interactive & Smooth** – Drag, drop, right-click, and edit with ease.
- 🔐 **Private & Local** – Your data is yours. Export, backup, and control.
- ☁️ **Cloud Sync** – Optional sync via Vercel Blob.
- 🌐 **Clerk-Account** – Easily login with third-party.
- 🌍 **International** – Automatically adapts to your language (English / 中文).
- 🧱 **Customizable** – Tailor themes, default view, and integrations.

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui, TypeScript
- **Auth**: Clerk
- **Storage**: LocalStorage, Vercel Blob
- **Weather**: OpenWeather API

![TechStack](https://skills-icons.vercel.app/api/icons?i=nextjs,ts,tailwindcss,shadcnui,clerk,vercel,openweather,bun)

## Preview

![Home](public/Home.jpg)
![App](/public/Banner.jpg)

## Getting Started

### Prerequisites

Required Versions:

- [NodeJS](https://nodejs.org) (v18 or higher)
- [Bun](https://bun.dev) (v1.2 or higher)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/Dev-Huang1/One-Calendar.git
cd One-Calendar

# Install dependencies
bun install

# Start the app
bun run dev
```

Then visit `http://localhost:3000`

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
NEXT_PUBLIC_BASE_URL=your-url

# Clerk API key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret

# Weather API
OPENWEATHER_API_KEY=your-open-weather-api-key

# Vercel blob token
BLOB_READ_WRITE_TOKEN=your-vercel-blob-token
```

## Roadmap

You can report a bug or request a new feature on our feedback website

[Roadmap & Feedback](https://feedback.xyehr.cn)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Dev-Huang1/One-Calendar&type=Date)](https://www.star-history.com/#Dev-Huang1/One-Calendar&Date)

## The Team

Brought to you by a small team of makers who love clean tools and open-source.

Check out our [contributors](https://github.com/Dev-Huang1/One-Calendar/graphs/contributors) ❤️

## Acknowledgements

This project wouldn't be possible without these awesome services:

<div style="display: flex; justify-content: center;">
  <a href="https://vercel.com" style="text-decoration: none;">
    <img src="https://github.com/user-attachments/assets/5107d47f-7ce9-425a-8e24-77c322205bd4" alt="Vercel" width="96"/>
  </a>
  <a href="https://clerk.com" style="text-decoration: none;">
    <img src="https://github.com/user-attachments/assets/6f9fa5d7-e0c2-4c14-aef9-e39bd0465e23" alt="Clerk" width="96"/>
  </a>
  <a href="https://openweathermap.org" style="text-decoration: none;">
    <img src="https://github.com/user-attachments/assets/d07ed7a1-c374-45f5-90fd-17c3de2a9098" alt="OpenWeather API" width="96"/>
  </a>
</div>

## License

[GPL 3.0 Licensed](./LICENSE). Copyright © One Calendar 2025.
