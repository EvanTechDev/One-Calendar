"use client"

import Link from "next/link"
import { ArrowRight, ChevronRight, Plus } from "lucide-react"
import { motion } from "framer-motion"

const navItems = [
  { label: "Product", href: "/about" },
  { label: "Resources", href: "/privacy" },
  { label: "Pricing", href: "/terms" },
  { label: "Customers", href: "/about" },
]

const valueCards = [
  {
    title: "Purpose-built for planning",
    description: "Turn rough plans into clear weekly execution without losing momentum.",
  },
  {
    title: "Designed to move fast",
    description: "Keyboard-first actions, instant updates, and a timeline that stays readable.",
  },
  {
    title: "Crafted for teams",
    description: "Share priorities, keep context visible, and align everyone on the same calendar.",
  },
]

const footerColumns = [
  {
    title: "Features",
    links: ["Plan", "Build", "Insights", "Requests", "Security"],
  },
  {
    title: "Product",
    links: ["Pricing", "Integrations", "Changelog", "Documentation", "Download"],
  },
  {
    title: "Company",
    links: ["About", "Customers", "Careers", "Quality", "Brand"],
  },
  {
    title: "Resources",
    links: ["Developers", "Status", "Startups", "Privacy", "Terms"],
  },
]

const reveal = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div className="mx-auto max-w-[1600px]">
        <header className="border-b border-white/10">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 sm:px-10">
            <Link href="/" className="flex items-center gap-3 text-lg font-semibold tracking-tight text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-xs">◍</span>
              One Calendar
            </Link>

            <nav className="hidden items-center gap-10 lg:flex">
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
            <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.45, ease: "easeOut" }}>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                  Plan the present.
                  <br />
                  Build the future.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
                  One Calendar helps product teams align priorities, run fast planning cycles, and ship with better rhythm.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
                className="flex gap-3"
              >
                <Link href="/about" className="rounded-lg bg-white/12 px-5 py-2.5 text-sm text-white transition hover:bg-white/18">
                  Contact sales
                </Link>
                <Link href="/sign-up" className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90">
                  Get started
                </Link>
              </motion.div>
            </div>
          </section>

          <section className="border-b border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.35 }}
                variants={reveal}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-white/70">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-white/75" />
                  Product planning workspace
                </div>
                <h2 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">Set your product direction.</h2>
                <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/60">
                  Align your team around one timeline. Plan, track, and communicate roadmap execution with clear context.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="relative mt-16 overflow-hidden rounded-2xl border border-white/10 bg-[#090909]"
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:90px_90px]" />
                <div className="relative p-7 sm:p-10">
                  <div className="text-sm text-white/65">Timeline overview</div>
                  <div className="mt-6 space-y-4">
                    {[
                      "Q1 foundation and migration",
                      "Beta workflow automation",
                      "Cross-team launch alignment",
                    ].map((row, index) => (
                      <motion.div
                        key={row}
                        initial={{ opacity: 0, x: -14 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: 0.08 + index * 0.08 }}
                        className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3"
                      >
                        <span className="text-sm text-white/85">{row}</span>
                        <span className="text-xs text-white/45">{index + 1}0%</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
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
                className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
              >
                <h3 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">Made for modern product teams.</h3>
                <p className="text-base leading-relaxed text-white/60">
                  Built with a strong focus on fast execution and high-quality planning. Keep docs, schedules, and decisions in one system.
                  <Link href="/about" className="ml-2 inline-flex items-center gap-1 font-medium text-white transition hover:text-white/80">
                    Make the switch <ChevronRight className="h-4 w-4" />
                  </Link>
                </p>
              </motion.div>

              <div className="mt-14 grid gap-5 md:grid-cols-3">
                {valueCards.map((card, idx) => (
                  <motion.article
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                    className="flex min-h-[220px] flex-col justify-between rounded-xl border border-white/10 bg-[#0b0b0b] p-6"
                  >
                    <div>
                      <div className="h-20 rounded-lg border border-white/10 bg-black/40" />
                      <h4 className="mt-5 text-2xl font-medium tracking-tight text-white">{card.title}</h4>
                      <p className="mt-3 text-sm leading-relaxed text-white/60">{card.description}</p>
                    </div>
                    <button type="button" className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition hover:text-white">
                      <Plus className="h-4 w-4" />
                    </button>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="mx-auto max-w-6xl px-6 py-20 sm:px-10">
          <div className="grid gap-12 border-t border-white/10 pt-14 lg:grid-cols-[200px_1fr]">
            <div className="flex items-start gap-3 text-xl font-semibold tracking-tight text-white">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-xs">◍</span>
              One Calendar
            </div>

            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h5 className="text-sm font-medium text-white">{column.title}</h5>
                  <ul className="mt-5 space-y-3">
                    {column.links.map((link) => (
                      <li key={link}>
                        <Link href="/about" className="text-sm text-white/55 transition hover:text-white/85">
                          {link}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} One Calendar</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="transition hover:text-white/80">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white/80">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
