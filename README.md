# WiseURL

<div align="center">

> **The Privacy-First, Self-Hosted Affiliate Link Manager.**  
> *Created with support from and maintained by [CouponSwift](https://www.couponswift.com).*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-blue)](https://tailwindcss.com/)

[Features](#features) • [Getting Started](#getting-started) • [Deploy](#deploy-to-netlify) • [Contributing](#contributing)

</div>



---

## ❤️ Built by CouponSwift

WiseURL is maintained by the team at **[CouponSwift](https://www.couponswift.com)**.

We are the premier destination for exclusive software deals, helping thousands of valid users stop paying full price. CouponSwift provides verified promo codes for top Web Hosting providers, VPNs, AI Tools, and SaaS platforms.

We built WiseURL because we needed a privacy-focused, reliable link manager for our own high-traffic affiliate campaigns. Now we're sharing it with the world.

## 🚀 Why WiseURL?

WiseURL is a powerful, open-source alternative to services like Bitly or Dub.co, designed specifically for affiliate marketers who care about **data ownership** and **privacy**.

- **Own Your Data**: Self-host on your own infrastructure. No lock-in.
- **Privacy Focused**: No IP tracking. We respect user privacy while giving you the analytics you need.

## ✨ Features

- 🔗 **Short Links** - Create memorable affiliate links like `/hostgator`
- 🎯 **Link Groups & Tags** - Organize your links with folders and tags
- 📊 **Detailed Analytics** - Track clicks, OS breakdown, and top performing links
- 📥 **Data Export** - Export your link data and click stats to CSV
- 🔍 **Search & Filter** - Quickly find links by name, tag, or date range
- 📱 **Responsive** - Works great on mobile and desktop
- ⚡ **Edge Performance** - Lightning-fast redirects worldwide

## 🛠️ Tech Stack

Built with the bleeding edge modern web stack.

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL & Auth)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI**: Lucide React, Radix UI, Recharts

## 🏁 Getting Started

Clone the repo and start your own instance in minutes.

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/WiseUrl.git
cd WiseUrl/app
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor and run the contents of `supabase/schema.sql`
3. Get your **Project URL** and **anon Key** from Project Settings > API

### 3. Configure Environment

1. Copy the example file:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your configuration:

```env
# URL for your site (important for generating copyable links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Keys
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Create Admin User

Since there is no public sign-up page (for security), you need to create your first user manually:

1. Go to your Supabase Dashboard > **Authentication**.
2. Click **Add User** -> **Create New User**.
3. Enter your email and password.
4. Toggle "Auto Confirm User" to ON.
5. Click **Create User**.

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your app!

## ☁️ Deploy to Netlify

The easiest way to deploy WiseURL is with Netlify.

1. Fork this repository.
2. Create a new site on Netlify and select your forked repo.
3. Add your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Netlify Build settings.
4. Deploy!

## 🤝 Contributing

We welcome contributions! Please feel free to **Fork** this repository and modify it to verify your own needs.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🔒 Privacy

WiseURL does not store IP addresses. Only country-level geo data is collected for analytics.

## License

MIT
