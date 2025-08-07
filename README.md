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


<a href="https://vercel.com/new/clone?repository-url=https://github.com/EvanTechDev/One-Calendar&env=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY&project-name=one-calendar&repo-name=one-calendar" style="display: inline-block;"><img src="https://vercel.com/button" alt="Deploy with Vercel" style="height: 32px;"></a>
<a href="https://app.netlify.com/start/deploy?repository=https://github.com/EvanTechDev/One-Calendar" style="display: inline-block;"><img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" style="height: 32px;"></a>


</div>

## What is One Calendar?

**One Calendar** is a privacy-first, weekly-focused, open-source calendar app, designed to help individuals and teams plan, focus, and stay in sync.

> Without *One Calendar*, your schedule is scattered. With it, your week feels intentional.

<a href="https://producthunt.com/product/one-calendar"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=955482&theme=light&t=1748791250175"></img></a>

## Why One Calendar?

Most calendar tools are cluttered, over-engineered, or locked behind paywalls. One Calendar aims to be:

- 🧠 **AI Powered** – AI-first app that streamlines your scheduling.
- 🕹 **Interactive & Smooth** – Drag, drop, right-click, and edit with ease.
- 🔐 **Private & Local** – Your data is yours. Export, backup, and control.
- ☁️ **Cloud Sync** – Optional sync via PostgreSQL.
- 🌐 **Clerk Account** – Easily login with third-party.
- 🌍 **International** – Automatically adapts to your language (English / 中文).
- 🧱 **Customizable** – Tailor themes, default view, and integrations.

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, shadcn/ui, TypeScript
- **Auth**: Clerk
- **Storage**: PostgreSQL
- **Weather**: OpenWeather API
- **AI**: Groq API
- **Analytics**: Vercel Analytics
- **Deploy**: Vercel

![TechStack](https://skills-icons.vercel.app/api/icons?i=nextjs,ts,tailwindcss,shadcnui,clerk,groq,vercel,openweather,bun,postgresql)

## Preview

![App](/public/Banner.jpg)
![Green](https://github.com/user-attachments/assets/3d5da3bd-007b-4e45-9833-da86d0122598)
![Yellow](https://github.com/user-attachments/assets/ab667369-c258-41b8-b8e1-f660606b9faa)

## Getting Started

### Prerequisites

Required Versions:

- [NodeJS](https://nodejs.org) (v18 or higher)
- [Bun](https://bun.sh) (v1.2 or higher)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar

# Install dependencies
bun install

# Start the app
bun dev
```

Then visit `http://localhost:3000`

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# Required 
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SALT=Backup-Salt

# Auth (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret

# Optional
GROQ_API_KEY=your-groq-api
OPENWEATHER_API_KEY=your-open-weather-api-key

# Optional, database
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar

# Optional, Cloudflare turnstile captcha
NEXT_PUBLIC_TURNSTILE_SITE_KEY=site-key
TURNSTILE_SECRET_KEY=secret-key
```

### Environment Setup

1. SALT

Install Openssl and Use this command to generate a SALT

```
openssl rand -hex 16
```

Then copy it into .env

2. PostgreSQL

Run this command if you installed docker

```
bun run db
```

And the env:

```env
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar
```

3. Cloudflare Turnstile

Go to [Cloudflare dashboard](https://dash.cloudflare.com)

Login and click the Turnstile button

![home](https://github.com/user-attachments/assets/3233e31d-1dac-4ab1-ac2a-e66f1eff4bbc)

Click the Add Widget button

![Widget](https://github.com/user-attachments/assets/c9428ab6-159e-45b0-8a6e-ba536eb59c5c)

Name it and add a hostname, then choose Managed and click the Create button 

![Create](https://github.com/user-attachments/assets/6c5d7e37-aad6-4a16-aea9-f0369e6b3bb8)

Copy your SiteKey and SecretKey and fill it into .env

![Key](https://github.com/user-attachments/assets/240b13b6-139e-4eeb-8781-71ae30b04752)

Why don't I just use Clerk's Captcha? Maybe there are bugs.

4. Groq

Go to [Groq Console](https://console.groq.com) and login

Click the `Create API Key`

![Screenshot_20250502_150743](https://github.com/user-attachments/assets/1e8faf08-7afe-405e-83a7-01039de35338)

Copy your API Key

![Screenshot_20250502_150857](https://github.com/user-attachments/assets/55374169-7f2b-480d-924f-80a46b014551)

Fill in the env file:

```env
GROQ_API_KEY=your-api-key
```

## Roadmap

You can report a bug or request a new feature on our feedback website

[Roadmap & Feedback](https://feedback.xyehr.cn)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=EvanTechDev/One-Calendar&type=Date)](https://www.star-history.com/#EvanTechDev/One-Calendar&Date)

## The Team

Brought to you by a small team of makers who love clean tools and open-source.

Check out our [contributors](https://github.com/EvanTechDev/One-Calendar/graphs/contributors) ❤️

## Sponsor

BTC: `bc1qdhn6c7tlcaflzu3u5fva825l20k9eqnqag5xzj`

## Acknowledgements

This project wouldn't be possible without these awesome services:

<div style="display: flex; justify-content: center;">
  <a href="https://vercel.com" style="text-decoration: none;"><img src="https://github.com/user-attachments/assets/5107d47f-7ce9-425a-8e24-77c322205bd4" alt="Vercel" width="96"/></a>
  <a href="https://clerk.com" style="text-decoration: none;"><img src="https://github.com/user-attachments/assets/6f9fa5d7-e0c2-4c14-aef9-e39bd0465e23" alt="Clerk" width="96"/></a>
  <a href="https://groq.com" style="text-decoraion: none;"><img src="https://github.com/user-attachments/assets/650dc220-c0a7-4761-a7ce-2c24a7d75133" alt="Groq" width="96"></a>
  <a href="https://openweathermap.org" style="text-decoration: none;"><img src="https://github.com/user-attachments/assets/d07ed7a1-c374-45f5-90fd-17c3de2a9098" alt="OpenWeather API" width="96"/></a>
</div>

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0).  
See the [LICENSE](./LICENSE) file for details.

