'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

const ease = [0.23, 1, 0.32, 1] as const

export function LandingReveal({
  children,
  className,
  delay = 0,
  onLoad = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  onLoad?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const visible = { opacity: 1, y: 0, filter: 'blur(0px)' }

  return (
    <motion.div
      className={`landing-reveal ${className ?? ''}`}
      initial={
        reduceMotion ? false : { opacity: 0, y: 30, filter: 'blur(4px)' }
      }
      animate={onLoad || reduceMotion ? visible : undefined}
      whileInView={!onLoad && !reduceMotion ? visible : undefined}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  )
}

export function LandingWords({
  text,
  delay = 0,
}: {
  text: string
  delay?: number
}) {
  const reduceMotion = useReducedMotion()
  const words = text.split(' ')

  return (
    <span>
      {words.map((word, index) => (
        <span key={`${index}-${word}`}>
          <motion.span
            className="landing-word"
            initial={
              reduceMotion ? false : { opacity: 0, y: 15, filter: 'blur(4px)' }
            }
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: reduceMotion ? 0 : 0.4,
              delay: delay + index * 0.05,
              ease,
            }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  )
}
