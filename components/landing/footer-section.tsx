'use client'

import { ArrowUpRight } from 'lucide-react'
import { AnimatedWave } from './animated-wave'
import { APP_CONFIG } from '@/lib/config'

export function FooterSection() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative border-t border-foreground/10">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 lg:gap-8">
            <div className="md:col-span-2">
              <a href="/" className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display">One Calendar</span>
              </a>

              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">
                A privacy-first, weekly-focused open-source calendar built for
                clarity and control.
              </p>
            </div>

            {APP_CONFIG.landing.footerSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-medium mb-6">{section.title}</h3>
                <ul className="space-y-4">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2 group"
                      >
                        {link.label}
                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {currentYear} One Calendar. All rights reserved.
          </p>

          <a
            className="text-sm text-muted-foreground hover:text-foreground"
            href={APP_CONFIG.contact.statusPageUrl}
          >
            Status page available
          </a>
        </div>
      </div>
    </footer>
  )
}
