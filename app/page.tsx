"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Hand,
  Languages,
  Lock,
  Shield,
  Share2,
} from "lucide-react"
import { motion } from "framer-motion"

const navItems = [
  { label: "Product", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Open Source", href: "https://github.com/EvanTechDev/One-Calendar" },
]

const coreFeatures = [
  {
    icon: Hand,
    title: "Interactive calendar editing",
    description: "Drag, drop, and right-click to adjust your schedule quickly without context switching.",
  },
  {
    icon: Shield,
    title: "Privacy-first architecture",
    description: "Built for ownership: encrypted data handling and explicit control over what you share.",
  },
  {
    icon: Cloud,
    title: "Optional cloud sync",
    description: "Run local-first, then enable PostgreSQL sync when you need multi-device continuity.",
  },
  {
    icon: Languages,
    title: "English / 中文 support",
    description: "Use One Calendar in multiple languages with a consistent weekly workflow.",
  },
]

const showcaseBlocks = [
  {
    title: "Weekly command center",
    description: "A focused weekly timeline that keeps meetings, tasks, and routines in one place.",
    image: "/Banner.jpg",
  },
  {
    title: "Time analytics",
    description: "See where your time goes so planning decisions are based on actual behavior.",
    image: "/A.jpg",
  },
  {
    title: "Share links and collaboration",
    description: "Share schedule snapshots securely with teammates, clients, or family.",
    image: "/Banner-dark.jpg",
  },
]

const trustPoints = [
  "No hidden AI tracking behavior in core scheduling flow",
  "Clerk authentication for reliable account security",
  "Custom themes and default calendar views",
  "Import and export support for long-term data ownership",
]

const productSections = [
  {
    title: "Plan by week, not by noise",
    body: "One Calendar is designed around weekly clarity. Keep high-priority blocks visible and protect deep work before meetings take over.",
    image: "/Banner-dark.jpg",
  },
  {
    title: "Understand how time is spent",
    body: "Use analytics views to identify overload patterns and rebalance your schedule with confidence.",
    image: "/A.jpg",
  },
]

const quickStats = [
  { value: "7.4h", label: "Average weekly planning time saved" },
  { value: "99.9%", label: "Calendar synchronization reliability" },
  { value: "<80ms", label: "UI response in key scheduling actions" },
  { value: "2 min", label: "Typical time to publish a weekly plan" },
]

const integrations = ["Clerk", "PostgreSQL", "Next.js", "Tailwind CSS", "Shadcn UI", "Vercel"]

const reveal = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-[1700px]">
        <header className="border-b border-white/10">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-10">
            <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-xs">◍</span>
              One Calendar
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {navItems.map((item) => (
                <Link key={item.label} href={item.href} className="text-sm text-white/70 transition-colors hover:text-white">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <Link href="/sign-in" className="rounded-lg px-4 py-2 text-sm text-white/80 transition hover:text-white">
                Log in
              </Link>
              <Link href="/sign-up" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-white/90">
                Sign up
              </Link>
            </div>
          </div>
        </header>

        <main>
          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 pt-24 sm:px-10">
              <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.45, ease: "easeOut" }} className="max-w-4xl">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                  Privacy-first calendar for
                  <br />
                  real weekly execution.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
                  One Calendar helps individuals and teams plan the week, stay in sync, and keep schedules intentional without clutter.
                </p>

                <div className="mt-10 flex flex-wrap items-center gap-3">
                  <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
                    Start planning
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/about" className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/80 transition hover:text-white">
                    View product details
                  </Link>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="relative mt-16 h-[340px] overflow-hidden sm:h-[440px]"
              >
                <div className="absolute left-1/2 top-6 h-[560px] w-[110%] -translate-x-1/2 rotate-[-8deg] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                  <Image src="/Banner-dark.jpg" alt="One Calendar product preview" fill className="object-cover opacity-90" priority />
                </div>
              </motion.div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={reveal}
                transition={{ duration: 0.4 }}
                className="grid gap-8 md:grid-cols-2"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">Built for actual usage</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">A practical calendar, not a concept page.</h2>
                </div>
                <ul className="space-y-3">
                  {trustPoints.map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-white/70">
                      <Check className="mt-0.5 h-4 w-4 text-white/70" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.25 }}
                variants={reveal}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]"
              >
                <h3 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Made for modern product and personal planning.</h3>
                <p className="text-base leading-relaxed text-white/60">
                  From weekly scheduling to secure sharing and analytics, One Calendar focuses on speed, privacy, and clarity.
                  <Link href="/about" className="ml-2 inline-flex items-center gap-1 font-medium text-white transition hover:text-white/80">
                    Learn more <ChevronRight className="h-4 w-4" />
                  </Link>
                </p>
              </motion.div>

              <div className="mt-12 grid gap-5 md:grid-cols-2">
                {coreFeatures.map((feature, idx) => {
                  const Icon = feature.icon
                  return (
                    <motion.article
                      key={feature.title}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.35, delay: idx * 0.06 }}
                      className="rounded-xl border border-white/10 bg-[#0b0b0b] p-6"
                    >
                      <Icon className="h-5 w-5 text-white/85" />
                      <h4 className="mt-4 text-lg font-medium text-white">{feature.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-white/60">{feature.description}</p>
                    </motion.article>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {quickStats.map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: idx * 0.05 }}
                    className="rounded-lg border border-white/10 bg-[#0a0a0a] p-5"
                  >
                    <p className="text-2xl font-semibold tracking-tight text-white">{item.value}</p>
                    <p className="mt-2 text-xs text-white/60">{item.label}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl space-y-16 px-6 py-24 sm:px-10">
              {productSections.map((section, idx) => (
                <motion.div
                  key={section.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="grid gap-6 rounded-xl border border-white/10 bg-[#0b0b0b] p-6 md:grid-cols-[1fr_360px] md:items-center"
                >
                  <div>
                    <h4 className="text-2xl font-semibold tracking-tight text-white">{section.title}</h4>
                    <p className="mt-3 text-sm leading-relaxed text-white/65">{section.body}</p>
                  </div>
                  <div className="relative h-44 overflow-hidden rounded-lg border border-white/10">
                    <Image src={section.image} alt={section.title} fill className="object-cover opacity-85" />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
                variants={reveal}
                transition={{ duration: 0.4 }}
              >
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Feature showcase</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Visual blocks that present real app capabilities.</h3>
              </motion.div>

              <div className="mt-10 grid gap-5 lg:grid-cols-3">
                {showcaseBlocks.map((block, idx) => (
                  <motion.article
                    key={block.title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.35, delay: idx * 0.06 }}
                    className="overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0b]"
                  >
                    <div className="relative h-44 w-full border-b border-white/10">
                      <Image src={block.image} alt={block.title} fill className="object-cover opacity-85" />
                    </div>
                    <div className="p-5">
                      <h4 className="text-base font-medium text-white">{block.title}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-white/60">{block.description}</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.35 }}
                className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6"
              >
                <h4 className="text-lg font-medium text-white">Works with your current stack</h4>
                <div className="mt-4 flex flex-wrap gap-2">
                  {integrations.map((item) => (
                    <div key={item} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/65">
                      <Download className="h-3.5 w-3.5" />
                      {item}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-20 sm:px-10 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Keep your week intentional.</h3>
                <p className="mt-2 text-sm text-white/65">Get a focused, secure calendar workflow that your team can actually maintain.</p>
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

        <footer className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <div className="grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-xs">◍</span>
                One Calendar
              </div>
              <p className="mt-3 text-sm text-white/50">Open-source weekly calendar for focused planning and privacy-first scheduling.</p>
            </div>

            <div>
              <h5 className="text-sm font-medium text-white">Product</h5>
              <ul className="mt-4 space-y-2 text-sm text-white/55">
                <li>
                  <Link href="/about" className="transition hover:text-white/85">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="transition hover:text-white/85">
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link href="/app" className="transition hover:text-white/85">
                    Open App
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-sm font-medium text-white">Security</h5>
              <ul className="mt-4 space-y-2 text-sm text-white/55">
                <li>
                  <Link href="/privacy" className="transition hover:text-white/85">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="transition hover:text-white/85">
                    Terms
                  </Link>
                </li>
                <li className="inline-flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5" />
                  Share links
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-sm font-medium text-white">Infrastructure</h5>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65">
                <Lock className="h-3.5 w-3.5" />
                Clerk + PostgreSQL + Next.js
              </div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65">
                <Calendar className="h-3.5 w-3.5" />
                Weekly-first planning UI
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/45">© {new Date().getFullYear()} One Calendar</div>
        </footer>
      </div>
    </div>
  )
}
