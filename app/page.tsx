"use client"

import Link from "next/link"
import { ArrowRight, CalendarClock, Sparkles, Workflow, Zap } from "lucide-react"
import { motion } from "framer-motion"

const featureCards = [
  {
    title: "Intelligent scheduling",
    description: "Let AI resolve conflicts, suggest priorities, and keep your week calm.",
    icon: Sparkles,
  },
  {
    title: "Unified timeline",
    description: "See tasks, events, and routines in one responsive command center.",
    icon: Workflow,
  },
  {
    title: "Zero-friction planning",
    description: "Jump from idea to scheduled block in seconds with keyboard-first flow.",
    icon: Zap,
  },
  {
    title: "Reliable reminders",
    description: "Stay in sync across devices without noise, misses, or duplicate nudges.",
    icon: CalendarClock,
  },
]

const metrics = [
  { label: "Focus windows automated", value: "92%" },
  { label: "Weekly planning time saved", value: "7.4h" },
  { label: "Cross-device sync delay", value: "<80ms" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black">
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:96px_96px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_80%_32%,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.06),transparent_40%)]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-8 sm:px-10 lg:px-12">
          <header className="flex items-center justify-between border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-xl sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/10 text-xs">◉</span>
              One Calendar
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-white/70 md:flex">
              <Link href="/about" className="transition hover:text-white">
                About
              </Link>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/sign-in" className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:text-white">
                Log in
              </Link>
              <Link href="/sign-up" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90">
                Start free
              </Link>
            </div>
          </header>

          <section className="relative py-24 sm:py-28">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="mx-auto max-w-4xl text-center"
            >
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/70">
                Built for deep work · AI-native calendar
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
                Plan with clarity.
                <br />
                Execute at <span className="text-white/70">lightspeed.</span>
              </h1>
              <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-white/65 sm:text-2xl sm:leading-relaxed">
                One Calendar gives teams a clean operational layer for time, priorities, and momentum—without clutter.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-base font-medium text-black transition hover:bg-white/90"
                >
                  Enter workspace
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3 text-base text-white/90 backdrop-blur transition hover:border-white/40 hover:bg-white/10"
                >
                  Create account
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="mt-14 rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.03] p-6 backdrop-blur-xl sm:p-8"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {metrics.map((metric, idx) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25 + idx * 0.08 }}
                    className="rounded-2xl border border-white/10 bg-black/50 p-6"
                  >
                    <p className="text-3xl font-semibold tracking-tight">{metric.value}</p>
                    <p className="mt-2 text-sm text-white/60">{metric.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          <section className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-2">
            {featureCards.map(({ title, description, icon: Icon }, idx) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="group relative overflow-hidden bg-black/70 p-8 sm:p-10"
              >
                <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_45%)]" />
                <Icon className="relative h-6 w-6 text-white/80" />
                <h3 className="relative mt-6 text-2xl font-semibold tracking-tight">{title}</h3>
                <p className="relative mt-4 max-w-md text-base leading-relaxed text-white/65">{description}</p>
                <div className="relative mt-8 inline-flex items-center gap-2 text-sm text-white/80">
                  Explore
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </motion.article>
            ))}
          </section>

          <section className="mt-20 grid gap-10 border border-white/10 bg-black/40 p-8 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-sm uppercase tracking-[0.24em] text-white/50">Workflow intelligence</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                A monochrome interface.
                <br />
                A colorful productivity outcome.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
                Every interaction is tuned for speed: subtle transitions, strong contrast, and cards that reveal only what you need.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              <div className="absolute -left-8 top-8 h-40 w-40 animate-pulse rounded-full bg-white/10 blur-3xl" />
              <div className="relative space-y-4">
                {["Syncing team focus blocks", "Generating optimal meeting windows", "Protecting deep-work sessions"].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/70 px-5 py-4"
                  >
                    <span className="text-sm text-white/80 sm:text-base">{item}</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-white/80" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>

          <footer className="mt-20 flex flex-col items-start justify-between gap-8 border-t border-white/10 py-10 text-sm text-white/50 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} One Calendar. Built for teams that move decisively.</p>
            <div className="flex items-center gap-5">
              <Link href="/sign-in" className="transition hover:text-white">
                Log in
              </Link>
              <Link href="/sign-up" className="transition hover:text-white">
                Sign up
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
