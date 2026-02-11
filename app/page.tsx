"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Calendar, Shield, Share2, Workflow, Clock3, ChevronRight } from "lucide-react"

const navItems = [
  { label: "Product", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "GitHub", href: "https://github.com/EvanTechDev/One-Calendar" },
]

const valueSections = [
  {
    kicker: "Speed",
    title: "Plan the week in minutes, not meetings.",
    description: "Weekly-first scheduling keeps your roadmap, deep work, and commitments aligned before the week gets noisy.",
    ctaLabel: "Explore weekly planning",
    ctaHref: "/about",
    image: "/Banner.jpg",
    icon: Clock3,
  },
  {
    kicker: "Clarity",
    title: "See one source of calendar truth.",
    description: "Unify events, priorities, and routines in a clean timeline so teams can decide faster with less context switching.",
    ctaLabel: "See product views",
    ctaHref: "/about",
    image: "/Banner-dark.jpg",
    icon: Calendar,
  },
  {
    kicker: "Coordination",
    title: "Share context without exposing everything.",
    description: "Secure links let you coordinate with teammates and clients while keeping private details protected by default.",
    ctaLabel: "Learn sharing",
    ctaHref: "/privacy",
    image: "/A.jpg",
    icon: Share2,
  },
  {
    kicker: "Security",
    title: "Privacy-first controls built into workflow.",
    description: "Account security, encrypted data paths, and optional sync let you scale usage without losing ownership.",
    ctaLabel: "Read privacy",
    ctaHref: "/privacy",
    image: "/Banner-dark.jpg",
    icon: Shield,
  },
  {
    kicker: "Scalability",
    title: "From personal planning to team operations.",
    description: "Move from solo schedule management to cross-functional planning with the same fast, minimal interface.",
    ctaLabel: "Start with your team",
    ctaHref: "/sign-up",
    image: "/Banner.jpg",
    icon: Workflow,
  },
]

const metrics = [
  { value: "7.4h", label: "Average planning time saved per week" },
  { value: "99.9%", label: "Schedule sync reliability" },
  { value: "<80ms", label: "Timeline interaction response" },
  { value: "2 min", label: "From draft week to shared plan" },
]

const reveal = {
  hidden: { opacity: 0, y: 16 },
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
            <motion.div initial="hidden" animate="visible" variants={reveal} transition={{ duration: 0.45, ease: "easeOut" }} className="max-w-4xl">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Modern calendar workflow
                <br />
                for speed and clarity.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
                One Calendar helps product teams and individuals plan with precision, coordinate effortlessly, and execute with confidence.
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
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.05 }}
              className="relative mt-14 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.15),transparent_45%)]" />
              <div className="relative h-[360px] sm:h-[480px]">
                <Image src="/Banner-dark.jpg" alt="One Calendar hero preview" fill className="object-cover" priority />
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric, idx) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, y: 10 }}
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

        {valueSections.map((section, idx) => {
          const Icon = section.icon
          const reverse = idx % 2 === 1

          return (
            <section key={section.title} className="border-b border-white/10">
              <div className="mx-auto grid max-w-6xl gap-8 px-6 py-24 sm:px-10 lg:grid-cols-2 lg:items-center">
                <motion.div
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={reveal}
                  transition={{ duration: 0.4 }}
                  className={reverse ? "lg:order-2" : ""}
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
                    <Icon className="h-3.5 w-3.5" />
                    {section.kicker}
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{section.title}</h2>
                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65">{section.description}</p>
                  <Link href={section.ctaHref} className="mt-7 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85 transition hover:text-white">
                    {section.ctaLabel}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: 0.06 }}
                  className={reverse ? "lg:order-1" : ""}
                >
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_40%)]" />
                    <div className="relative h-[280px] sm:h-[340px]">
                      <Image src={section.image} alt={section.title} fill className={reverse ? "object-cover rotate-[-4deg] scale-110" : "object-cover rotate-[3deg] scale-110"} />
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>
          )
        })}

        <section className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-20 sm:px-10 md:flex-row md:items-center">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Build a faster planning rhythm.</h3>
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
    </div>
  )
}
