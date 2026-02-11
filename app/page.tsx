"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Check, ChevronRight, Shield, Cloud, Languages, Lock, Hand } from "lucide-react"
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
    title: "Interactive calendar",
    description: "Drag, drop, right-click, and edit events with a smooth weekly workflow.",
  },
  {
    icon: Shield,
    title: "Privacy-first by design",
    description: "Your schedule stays yours with encrypted storage and control over sharing.",
  },
  {
    icon: Cloud,
    title: "Optional cloud sync",
    description: "Use PostgreSQL sync when needed, or keep your setup local and lightweight.",
  },
  {
    icon: Languages,
    title: "English / 中文",
    description: "Localization is built in, so teams can use the same product in their own language.",
  },
]

const showcaseBlocks = [
  {
    title: "Weekly view for focused planning",
    description: "See your priorities, meetings, and personal routines in one clean timeline.",
    image: "/Banner.jpg",
  },
  {
    title: "Analytics for time awareness",
    description: "Track how your time is spent and adjust plans based on real weekly patterns.",
    image: "/A.jpg",
  },
  {
    title: "Sharing and collaboration",
    description: "Generate secure share links to align with teammates, clients, or family.",
    image: "/Banner-dark.jpg",
  },
]

const trustPoints = [
  "No AI tracking layer in core scheduling flow",
  "Clerk authentication with modern account security",
  "Theme and default-view customization",
  "Import/export workflows for flexible ownership",
]

const reveal = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto max-w-[1600px]">
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
            <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
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
              </ul>
            </div>

            <div>
              <h5 className="text-sm font-medium text-white">Infrastructure</h5>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white/65">
                <Lock className="h-3.5 w-3.5" />
                Clerk + PostgreSQL + Next.js
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 text-sm text-white/45">© {new Date().getFullYear()} One Calendar</div>
        </footer>
      </div>
    </div>
  )
}
