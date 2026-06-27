import * as motion from 'motion/react-client'
import { cn } from '@zntr/utils'
import { Button } from '@zntr/ui/button'
import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden pt-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-hidden"
      >
        <div
          className={cn(
            'absolute inset-0 isolate -z-10',
            'bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]',
          )}
        />
      </div>
      <div className="relative z-10 flex max-w-2xl flex-col gap-5 px-4">
        <motion.a
          className={cn(
            'group bg-card flex w-fit items-center gap-3 rounded-sm border p-1 shadow-xs',
          )}
          initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="bg-card rounded-xs border px-1.5 py-0.5 shadow-sm">
            <p className="font-mono text-xs">NOW</p>
          </div>

          <span className="text-xs">Announcing One Calendar 3.0</span>
          <span className="block h-5 border-l" />

          <div className="pr-1">
            <ArrowRightIcon className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
          </div>
        </motion.a>

        <motion.h1
          className="text-foreground text-3xl leading-tight font-medium tracking-tight text-balance md:text-5xl"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.05,
              },
            },
          }}
        >
          {'Manage your all schedules in one place'
            .split(' ')
            .map((word, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: 15, filter: 'blur(4px)' },
                  show: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                  },
                }}
              >
                {word}&nbsp;
              </motion.span>
            ))}
        </motion.h1>

        <motion.p
          className="text-muted-foreground max-w-[65ch] text-sm leading-relaxed md:text-base"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.02,
                delayChildren: 0.3,
              },
            },
          }}
        >
          {'A calm calendar for people and teams who value clarity over complexity.'
            .split(' ')
            .map((word, i) => (
              <motion.span
                key={i}
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
                  show: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                  },
                }}
              >
                {word}&nbsp;
              </motion.span>
            ))}
        </motion.p>

        <motion.div
          className="flex w-fit items-center justify-center gap-3 pt-4"
          initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, delay: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <Link href="/sign-up" replace>
            <Button className="rounded-full pl-4 pr-1 py-2 text-sm active:scale-[0.97] transition-transform duration-[160ms] ease-[var(--ease-out)] group">
              <span className="mr-3">Get started</span>
              <div className="flex size-6 items-center justify-center rounded-full bg-background/20 transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105">
                <ArrowRightIcon data-icon="inline-end" />
              </div>
            </Button>
          </Link>
        </motion.div>
      </div>
      <div className="relative">
        <div
          className={cn(
            'absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-120 rounded-full',
            'bg-[radial-gradient(ellipse_at_center,theme(--color-foreground/.1),transparent,transparent)]',
            'blur-[50px]',
          )}
        />
        <motion.div
          className={cn(
            'relative mt-8 -mr-56 overflow-hidden mask-b-from-60% px-2 sm:mt-12 sm:mr-0 md:mt-20',
          )}
          initial={{ opacity: 0, y: 40, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="inset-shadow-foreground/10 bg-background/5 ring-foreground/5 relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border p-2 shadow-2xl ring-1 inset-shadow-2xs">
            <div className="relative rounded-[calc(2.5rem-0.5rem)] overflow-hidden border border-foreground/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]">
              <img
                alt="App screen preview"
                className="z-2 aspect-video w-full rounded-[calc(2.5rem-0.5rem)] object-cover"
                height="1080"
                src="https://github.com/user-attachments/assets/a076623e-3132-42e4-a947-d3e3e3c0cf53"
                width="1920"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
