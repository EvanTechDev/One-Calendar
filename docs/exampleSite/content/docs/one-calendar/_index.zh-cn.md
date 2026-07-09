---
linkTitle: "One Calendar"
title: One Calendar
next: /docs/one-calendar/url-to-add
sidebar:
open: true
---

<div align="center">
<img src="https://cal.xyehr.cn/icon.svg" width="72">

# One Calendar

<p>

<a href="https://vercel.com/tech-art/one-calendar" target="_blank" style="display: inline-block;"><img src="https://vercelbadge.vercel.app/api/EvanTechDev/One-Calendar?style=flat-square" alt="Vercel 项目状态"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/blob/master/LICENSE" target="blank" style="display: inline-block;"><img src="https://img.shields.io/github/license/EvanTechDev/One-Calendar?style=flat-square" alt="license"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/fork" target="blank" style="display: inline-block;"><img src="https://img.shields.io/github/forks/EvanTechDev/One-Calendar?style=flat-square" alt="forks"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/stargazers" target="blank" style="display: inline-block;"><img src="https://img.shields.io/github/stars/EvanTechDev/One-Calendar?style=flat-square" alt="stars"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/issues" target="blank" style="display: inline-block;"><img src="https://img.shields.io/github/issues/EvanTechDev/One-Calendar?style=flat-square" alt="issues"></a>
<a href="https://github.com/EvanTechDev/One-Calendar/pulls" target="blank" style="display: inline-block;"><img src="https://img.shields.io/github/issues-pr/EvanTechDev/One-Calendar?style=flat-square" alt="pull-requests"></a>

</p>

一款精美简约的开源日历应用，助您规划一周和生活。

<a href="https://vercel.com/new/clone?repository-url=https://github.com/EvanTechDev/One-Calendar&env=NEXT_PUBLIC_BASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY&project-name=one-calendar&repo-name=one-calendar" style="display: inline-block;"><img src="https://vercel.com/button" alt="使用 Vercel 部署" style="height: 32px;"></a>
<a href="https://app.netlify.com/start/deploy?repository=https://github.com/EvanTechDev/One-Calendar" style="display: inline-block;"><img src="https://www.netlify.com/img/deploy/button.svg" alt="部署到 Netlify" style="height: 32px;"></a>

</div>

## 什么是 One Calendar？

**One Calendar** 是一款注重隐私、专注于每周的开源日历应用，旨在帮助个人和团队规划、集中精力并保持同步。

> 如果没有 *One Calendar*，您的日程安排就会变得杂乱无章。有了它，您的一周就会感觉井井有条。

<a herf="https://producthunt.com/product/one-calendar"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=955482&theme=light&t=1748791250175" style="display: inline-block;"></img></a>

## 为什么选择 One Calendar？

大多数日历工具都功能杂乱、设计过度，或者需要付费才能使用。 One Calendar 的目标是：

- 🧠 **AI 赋能** – AI 优先的应用，简化您的日程安排。
- 🕹 **交互流畅** – 轻松拖放、右键点击和编辑。
- 🔐 **私密本地** – 您的数据由您掌控。导出、备份和控制。
- ☁️ **云同步** – 可选通过 PostgreSQL 同步。
- 🌐 **Clerk-Account** – 轻松使用第三方账户登录。
- 🌍 **国际化** – 自动适应您的语言（英语/中文）。
- 🧱 **可自定义** – 定制主题、默认视图和集成。

## 技术栈

- **前端**：Next.js 14、Tailwind CSS、shadcn/ui、TypeScript
- **授权**：Clerk
- **存储**：PostgreSQL
- **天气**：OpenWeather API
- **人工智能**：Groq API
- **分析**：Vercel Analytics
- **部署**：Vercel

<img src="https://skills-icons.vercel.app/api/icons?i=nextjs,ts,tailwindcss,shadcnui,clerk,groq,vercel,openweather,bun.postgresql" style="display: inline-block;"></img>

##预览

![App](https://cal.xyehr.cn/Banner.jpg)
![绿色](https://github.com/user-attachments/assets/3d5da3bd-007b-4e45-9833-da86d0122598)
![黄色](https://github.com/user-attachments/assets/ab667369-c258-41b8-b8e1-f660606b9faa)

## 入门指南

### 先决条件

所需版本：

- [NodeJS](https://nodejs.org) (v18 或更高版本)
- [Bun](https://bun.sh) (v1.2 或更高版本)

### 快速入门

```bash
# 克隆代码库
git clone https://github.com/EvanTechDev/One-Calendar.git
cd One-Calendar

# 安装依赖项
bun install

# 启动应用
bun dev
```

然后访问 `http://localhost:3000`

### 环境变量

将 `.env.example` 复制到 `.env` 并填写：

```env
# 必填
NEXT_PUBLIC_BASE_URL=http://localhost:3000
SALT=Backup-Salt

# 授权（必填）
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret

# 可选
GROQ_API_KEY=your-groq-api
OPENWEATHER_API_KEY=your-open-weather-api-key

# 可选数据库
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar

# 可选，Cloudflare Turnstile 验证码
NEXT_PUBLIC_TURNSTILE_SITE_KEY=SiteKey
TURNSTILE_SECRET_KEY=SecretKey
```

### 环境设置

1. SALT

安装 OpenSSL 并使用此命令生成 SALT 文件

```
openssl rand -hex 16
```

然后将其复制到.env

2. PostgreSQL

如果您安装了 docker，请运行以下命令：

```
bun run db
```

环境变量：

```env
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/onecalendar
```

3. Cloudflare Turnstile

> [!NOTE]\
> 正在更新

4. Groq

前往 [Groq 控制台](https://console.groq.com) 并登录

点击“创建 API 密钥”

![Screenshot_20250502_150743](https://github.com/user-attachments/assets/1e8faf08-7afe-405e-83a7-01039de35338)

复制您的 API密钥

![Screenshot_20250502_150857](https://github.com/user-attachments/assets/55374169-7f2b-480d-924f-80a46b014551)

填写 env 文件：

```env
GROQ_API_KEY=你的 API 密钥
```

## 路线图

您可以在我们的反馈网站上报告错误或请求新功能。

[路线图和反馈](https://feedback.xyehr.cn)

## Star 历史

[![星历图表](https://api.star-history.com/svg?repos=EvanTechDev/One-Calendar&type=Date)](https://www.star-history.com/#EvanTechDev/One-Calendar&Date)

## 团队

由一支热爱简洁工具和开源的小型团队为您倾情打造。

查看我们的[贡献者](https://github.com/EvanTechDev/One-Calendar/graphs/contributors) ❤️

## 赞助

BTC：`bc1qdhn6c7tlcaflzu3u5fva825l20k9eqnqag5xzj`

## 致谢

如果没有这些优秀的服务，这个项目就不可能实现：

<div style="justify-content: center;">

<a href="https://vercel.com" style="text-decoration: none; display: inline-block;"><img src="https://github.com/user-attachments/assets/5107d47f-7ce9-425a-8e24-77c322205bd4" alt="Vercel" width="96"/></a>
<a href="https://clerk.com" style="text-decoration: none; display: inline-block;"><img src="https://github.com/user-attachments/assets/6f9fa5d7-e0c2-4c14-aef9-e39bd0465e23" alt="Clerk" width="96"/></a>
<a href="https://groq.com" style="text-decoraion: none; display: inline-block;"><img src="https://github.com/user-attachments/assets/650dc220-c0a7-4761-a7ce-2c24a7d75133" alt="Groq" width="96"></a>
<a href="https://openweathermap.org" style="text-decoration: none; display: inline-block;"><img src="https://github.com/user-attachments/assets/d07ed7a1-c374-45f5-90fd-17c3de2a9098" alt="OpenWeather API" width="96"/></a>

</div>

## 许可证

本项目采用 GNU 通用公共许可证 v3.0 (GPL-3.0) 授权。
详情请参阅 [LICENSE](./LICENSE) 文件。
