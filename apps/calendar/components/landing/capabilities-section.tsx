import * as motion from 'motion/react-client'
import {
  ArrowLeftRight,
  BellRing,
  Bot,
  CalendarRange,
  Keyboard,
  Languages,
  MailCheck,
  Moon,
  RefreshCw,
  Repeat2,
  ShieldCheck,
} from 'lucide-react'

const capabilities = [
  { label: 'AI agent over MCP', icon: Bot },
  { label: 'Google Calendar sync', icon: RefreshCw },
  { label: 'Recurring events', icon: Repeat2 },
  { label: 'RSVP invitations', icon: MailCheck },
  { label: 'Smart reminders', icon: BellRing },
  { label: 'Keyboard-first editing', icon: Keyboard },
  { label: 'ICS import & export', icon: ArrowLeftRight },
  { label: '34 languages', icon: Languages },
  { label: 'Light & dark themes', icon: Moon },
  { label: 'Year heatmap', icon: CalendarRange },
  { label: 'Encrypted sync', icon: ShieldCheck },
]

const EASE = [0.16, 1, 0.3, 1] as const

export function CapabilitiesSection() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 md:px-8">
      <div className="space-y-2 text-center">
        <motion.p
          className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.18em]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          Built for your schedule
        </motion.p>
        <motion.h2
          className="text-foreground text-lg font-medium tracking-tight text-balance md:text-xl"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
        >
          Every capability Zentra has,{' '}
          <span className="text-foreground/40">in one place.</span>
        </motion.h2>
      </div>

      <motion.div
        className="mt-8 flex flex-wrap justify-center gap-1.5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {capabilities.map((capability, i) => (
          <motion.span
            key={capability.label}
            className="border-foreground/10 bg-background/5 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              ease: EASE,
              delay: 0.08 + i * 0.06,
            }}
          >
            <capability.icon className="size-3" />
            {capability.label}
          </motion.span>
        ))}
      </motion.div>

      <motion.p
        className="text-muted-foreground mx-auto mt-6 max-w-[46ch] text-center text-sm leading-relaxed"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        All of it ships in the box — no plugins to install, no per-feature
        upgrade, and nothing that only works on one platform.
      </motion.p>
    </section>
  )
}
