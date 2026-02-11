"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import {
  ArrowRight,
  BarChart3,
  Calendar,
  ChevronRight,
  Cloud,
  Languages,
  Lock,
  Share2,
  Shield,
  Sparkles,
} from "lucide-react"

const navItems = [
  { label: "Product", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "GitHub", href: "https://github.com/EvanTechDev/One-Calendar" },
]

const trustPoints = [
  "Interactive drag-and-drop editing for weekly planning",
  "Privacy-first architecture with encrypted data flow",
  "Optional PostgreSQL cloud sync",
  "English / 中文 built-in localization",
]

const featureGrid = [
  {
    icon: Calendar,
    title: "Weekly focus",
    desc: "Design each week around priorities before your calendar gets fragmented.",
  },
  {
    icon: Share2,
    title: "Secure sharing",
    desc: "Share schedule context with teammates without exposing private details.",
  },
  {
    icon: BarChart3,
    title: "Time analytics",
    desc: "Measure actual time usage and continuously improve planning quality.",
  },
  {
    icon: Cloud,
    title: "Flexible sync",
    desc: "Stay local-first or sync across devices based on team requirements.",
  },
  {
    icon: Languages,
    title: "Global usage",
    desc: "Run one planning workflow across multilingual teams.",
  },
  {
    icon: Shield,
    title: "Reliable security",
    desc: "Modern auth and controlled access designed for real operational use.",
  },
]

const productSections = [
  {
    kicker: "Speed",
    title: "Move from planning to execution faster.",
    body: "Turn rough weekly goals into clear scheduled blocks in minutes.",
    cta: "Explore weekly workflow",
    href: "/about",
    image: "/Banner.jpg",
  },
  {
    kicker: "Clarity",
    title: "Keep one source of planning truth.",
    body: "Unify personal routines, project timelines, and team events in one command center.",
    cta: "View product details",
    href: "/about",
    image: "/Banner-dark.jpg",
  },
  {
    kicker: "Coordination",
    title: "Align teams without communication noise.",
    body: "Share secure calendar snapshots and keep stakeholders synchronized.",
    cta: "Learn sharing",
    href: "/privacy",
    image: "/A.jpg",
  },
]

const showcaseCards = [
  {
    title: "Weekly dashboard",
    desc: "Visualize commitments, routines, and project deadlines in one lane.",
    image: "/Banner.jpg",
  },
  {
    title: "Behavior analytics",
    desc: "Review planning patterns and improve time distribution over time.",
    image: "/A.jpg",
  },
  {
    title: "Dark productivity mode",
    desc: "Focused interface designed for modern work environments.",
    image: "/Banner-dark.jpg",
  },
]

const metrics = [
  { value: "7.4h", label: "Average weekly planning time saved" },
  { value: "99.9%", label: "Calendar sync reliability" },
  { value: "<80ms", label: "Core interaction response" },
  { value: "2 min", label: "From draft week to shared plan" },
]

const reveal = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
          <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight text-white">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/30 text-[10px]">◍</span>
            One Calendar
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm text-white/70 transition-colors hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/sign-in" className="rounded-lg px-3.5 py-1.5 text-sm text-white/75 transition hover:text-white">
              Log in
            </Link>
            <Link href="/sign-up" className="rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-black transition hover:bg-white/90">
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:px-10">
            <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.45 }} className="max-w-4xl">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Modern calendar workflow
                <br />
                for speed and clarity.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
                Plan your week, align your team, and execute confidently with a privacy-first calendar system.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
                  Start planning
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/about" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/80 transition hover:text-white">
                  See how it works
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="relative mt-16 h-[360px] overflow-hidden sm:h-[480px]"
            >
              <div className="absolute left-1/2 top-6 h-[560px] w-[110%] -translate-x-1/2 rotate-[-7deg] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.15),transparent_45%)]" />
                <Image src="/Banner-dark.jpg" alt="One Calendar hero preview" fill className="object-cover" priority />
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-18 sm:px-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric, idx) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.05 }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
                >
                  <p className="text-2xl font-semibold tracking-tight text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-white/60">{metric.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Trust baseline</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Built for real weekly operation.</h2>
              </div>
              <ul className="space-y-3">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-white/70">
                    <Sparkles className="mt-0.5 h-4 w-4 text-white/70" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Core capabilities</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Feature grid for modern workflows.</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureGrid.map((item, idx) => {
                const Icon = item.icon
                return (
                  <motion.article
                    key={item.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: idx * 0.04 }}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm"
                  >
                    <Icon className="h-5 w-5 text-white/80" />
                    <h3 className="mt-4 text-base font-medium text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-white/60">{item.desc}</p>
                  </motion.article>
                )
              })}
            </div>
          </div>
        </section>

        {productSections.map((section, idx) => {
          const reverse = idx % 2 === 1
          return (
            <section key={section.title} className="border-b border-white/10">
              <div className="mx-auto grid max-w-6xl gap-8 px-6 py-24 sm:px-10 lg:grid-cols-2 lg:items-center">
                <div className={reverse ? "lg:order-2" : ""}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{section.kicker}</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{section.title}</h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65">{section.body}</p>
                  <Link href={section.href} className="mt-7 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85 backdrop-blur-sm transition hover:text-white">
                    {section.cta}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className={reverse ? "lg:order-1" : ""}>
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_45%)]" />
                    <div className="relative h-[280px] sm:h-[340px]">
                      <Image
                        src={section.image}
                        alt={section.title}
                        fill
                        className={reverse ? "object-cover rotate-[-4deg] scale-110" : "object-cover rotate-[3deg] scale-110"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )
        })}

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
            <p className="text-xs uppercase tracking-[0.18em] text-white/45">Visual showcase</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Product screens as capability storytelling.</h2>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {showcaseCards.map((card, idx) => (
                <motion.article
                  key={card.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: idx * 0.05 }}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm"
                >
                  <div className="relative h-44 border-b border-white/10">
                    <Image src={card.image} alt={card.title} fill className="object-cover opacity-90" />
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-medium text-white">{card.title}</h3>
                    <p className="mt-2 text-sm text-white/60">{card.desc}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-20 sm:px-10 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Build a faster planning rhythm.</h2>
              <p className="mt-2 text-sm text-white/65">Start with one calendar system your team can keep using every week.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/sign-in" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/80 transition hover:text-white">
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/60">© {new Date().getFullYear()} One Calendar</p>
            <div className="flex items-center gap-5 text-sm text-white/60">
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
              <Link href="/about" className="transition hover:text-white">
                About
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
