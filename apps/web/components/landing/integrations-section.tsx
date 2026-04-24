'use client'

import { useEffect, useState, useRef } from 'react'

const integrations = [
  { name: 'Clerk', category: 'Authentication' },
  { name: 'Bluesky', category: 'Community' },
  { name: 'PostgreSQL', category: 'Storage' },
  { name: 'ICS', category: 'Data format' },
  { name: 'JSON', category: 'Data format' },
  { name: 'CSV', category: 'Data format' },
  { name: 'Cloudflare', category: 'Infrastructure' },
  { name: 'Product Hunt', category: 'Community' },
  { name: 'i18n', category: 'Localization' },
  { name: 'Themes', category: 'Customization' },
  { name: 'E2EE', category: 'Privacy' },
]

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="integrations"
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`text-center max-w-3xl mx-auto mb-16 lg:mb-24 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Ecosystem
            <span className="w-8 h-px bg-foreground/30" />
          </span>
          <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-6">
            Built around formats
            <br />
            and tools you trust.
          </h2>
          <p className="text-xl text-muted-foreground">
            Open standards and practical services keep migration and
            collaboration simple.
          </p>
        </div>
      </div>

      <div className="w-full mb-6">
        <div className="flex gap-6 marquee">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {integrations.map((integration) => (
                <div
                  key={`${integration.name}-${setIndex}`}
                  className="shrink-0 px-8 py-6 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {integration.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {integration.category}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full">
        <div className="flex gap-6 marquee-reverse">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-6 shrink-0">
              {[...integrations].reverse().map((integration) => (
                <div
                  key={`${integration.name}-reverse-${setIndex}`}
                  className="shrink-0 px-8 py-6 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all duration-300 group"
                >
                  <div className="text-lg font-medium group-hover:translate-x-1 transition-transform">
                    {integration.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {integration.category}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
