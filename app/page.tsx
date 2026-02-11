"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

const reveal = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

const navigation = [
  { label: "Product", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
]

const highlights = [
  "Unified calendar for projects, meetings, and routines.",
  "Fast keyboard-first planning for daily execution.",
  "Reliable sync and reminders across all your devices.",
]

const capabilities = [
  {
    title: "Plan by priority",
    description: "Turn goals into structured calendar blocks in seconds.",
  },
  {
    title: "Coordinate as a team",
    description: "Share schedules, avoid collisions, and protect focus time.",
  },
  {
    title: "Stay consistent",
    description: "Build repeatable routines with clear visibility week to week.",
  },
  {
    title: "Move faster",
    description: "From quick capture to confirmed schedule without context switching.",
  },
]

const metrics = [
  { label: "Average planning time reduced", value: "7.4h / week" },
  { label: "Events synchronized", value: "99.9%" },
  { label: "Calendar response", value: "< 80ms" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-950">
      <div className="mx-auto max-w-6xl px-6 sm:px-10 lg:px-12">
        <header className="flex h-16 items-center justify-between border-b border-neutral-200">
          <Link href="/" className="text-base font-semibold tracking-tight text-neutral-950">
            One Calendar
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {navigation.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm text-neutral-600 transition-colors hover:text-neutral-950">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950">
              Log in
            </Link>
            <Link href="/sign-up" className="rounded-md bg-black px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800">
              Sign up
            </Link>
          </div>
        </header>

        <main>
          <section className="py-20 sm:py-28">
            <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.5, ease: "easeOut" }} className="max-w-4xl">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-neutral-950 sm:text-6xl">
                Plan the week.
                <br />
                Execute the work.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
                One Calendar helps modern teams organize priorities, protect focus time, and ship consistently.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Start scheduling
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/about" className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-neutral-950">
                  View product
                </Link>
              </div>
            </motion.div>
          </section>

          <section className="border-t border-neutral-200 py-14">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={reveal}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="grid gap-8 md:grid-cols-2"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Why teams choose One Calendar</p>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">Built for focus, not friction.</h2>
              </div>
              <ul className="space-y-4">
                {highlights.map((item) => (
                  <li key={item} className="border-b border-neutral-200 pb-4 text-base text-neutral-700 last:border-b-0 last:pb-0">
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </section>

          <section className="border-t border-neutral-200 py-14">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={reveal}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">Capabilities</p>
              <div className="mt-6 divide-y divide-neutral-200 border-y border-neutral-200">
                {capabilities.map((item) => (
                  <div key={item.title} className="grid gap-2 py-6 sm:grid-cols-[220px_1fr] sm:gap-8">
                    <h3 className="text-base font-medium text-neutral-950">{item.title}</h3>
                    <p className="text-base text-neutral-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          <section className="border-t border-neutral-200 py-14">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={reveal}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="grid gap-8 sm:grid-cols-3"
            >
              {metrics.map((metric) => (
                <div key={metric.label} className="border-l border-neutral-200 pl-4 first:border-l-0 first:pl-0">
                  <p className="text-2xl font-semibold tracking-tight text-neutral-950">{metric.value}</p>
                  <p className="mt-2 text-sm text-neutral-600">{metric.label}</p>
                </div>
              ))}
            </motion.div>
          </section>

          <section className="border-t border-neutral-200 py-20">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={reveal}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"
            >
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">Ready to organize time with confidence?</h2>
                <p className="mt-3 text-base text-neutral-600">Start with One Calendar and keep your team aligned every week.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/sign-up" className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800">
                  Get started
                </Link>
                <Link href="/sign-in" className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 hover:text-neutral-950">
                  Log in
                </Link>
              </div>
            </motion.div>
          </section>
        </main>

        <footer className="flex flex-col gap-3 border-t border-neutral-200 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} One Calendar</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-neutral-800">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-neutral-800">
              Terms
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
