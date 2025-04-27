<div align="center">
  <img src="public/icon.svg" width="72">

# One Calendar

<p>

<a href="https://vercel.com/tech-art/one-calendar" target="_blank"><img src="https://vercelbadge.vercel.app/api/EvanTechDev/One-Calendar?style=flat-square" alt="Vercel Project Status"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/blob/master/LICENSE" target="blank"><img src="https://img.shields.io/github/license/EvanTechDev/One-Calendar?style=flat-square" alt="license"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/fork" target="blank"><img src="https://img.shields.io/github/forks/EvanTechDev/One-Calendar?style=flat-square" alt="forks"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/stargazers" target="blank"><img src="https://img.shields.io/github/stars/EvanTechDev/One-Calendar?style=flat-square" alt="stars"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/issues" target="blank"><img src="https://img.shields.io/github/issues/EvanTechDev/One-Calendar?style=flat-square" alt="issues"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/pulls" target="blank"><img src="https://img.shields.io/github/issues-pr/EvanTechDev/One-Calendar?style=flat-square" alt="pull-requests"></a>

</p>

A beautifully minimal open-source calendar app to plan your week and life.

<a href="https://vercel.com/new/clone?repository-url=https://github.com/Dev-Huang1/One-Calendar&env=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,OPENWEATHER_API_KEY,BLOB_READ_WRITE_TOKEN&project-name=one-calendar&repo-name=one-calendar" style="display: inline-block;">
  <img src="https://vercel.com/button" alt="Deploy with Vercel" style="height: 32px;">
</a>

<a href="https://app.netlify.com/start/deploy?repository=https://github.com/Dev-Huang1/One-Calendar" style="display: inline-block;">
  <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" style="height: 32px;">
</a>

<a href="https://railway.app/new/template?template=https://github.com/Dev-Huang1/One-Calendar&envs=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,OPENWEATHER_API_KEY,BLOB_READ_WRITE_TOKEN&optionalEnvs=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,OPENWEATHER_API_KEY,BLOB_READ_WRITE_TOKEN&projectName=one-calendar" style="display: inline-block;">
  <img src="https://railway.app/button.svg" alt="Deploy on Railway" style="height: 32px;">
</a>

</div>

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

![TechStack](https://skills-icons.vercel.app/api/icons?i=nextjs,ts,tailwindcss,shadcnui,clerk,vercel,openweather,bun,groq)

## Preview

![Home](public/Home.jpg)
![App](/public/Banner.jpg)

## Getting Started

### Prerequisites

Required Versions:

- [NodeJS](https://nodejs.org) (v18 or higher)
- [Bun](https://bun.sh) (v1.2 or higher)

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
