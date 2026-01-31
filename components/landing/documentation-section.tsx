"use client"

import { useState, useEffect } from "react"

export default function DocumentationSection() {
  const [activeCard, setActiveCard] = useState(0)
  const [animationKey, setAnimationKey] = useState(0)

  const cards = [
    {
      title: "Plan your schedules",
      description: "Explore your data, build your dashboard, and save time together.",
      image: "/Banner.jpg",
    },
    {
      title: "Data to insights in minutes",
      description: "Transform raw data into actionable insights with powerful analytics tools.",
      image: "/A.jpg",
    },
    {
      title: "Share schedules safely",
      description: "Password-protect sharing with anyone and burn-after-read security.",
      image: "/S.jpg",
    },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % cards.length)
      setAnimationKey((prev) => prev + 1)
    }, 5000)

    return () => clearInterval(interval)
  }, [cards.length])

  const handleCardClick = (index: number) => {
    setActiveCard(index)
    setAnimationKey((prev) => prev + 1)
  }

  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-muted-foreground mb-4">PLATFORM</p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground text-balance">
            Streamline your business operations
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-[600px] mx-auto">
            Manage schedules, analyze data, and collaborate with your team all in one powerful platform.
          </p>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
          {/* Feature Cards */}
          <div className="w-full lg:w-[400px] flex flex-col gap-3 order-2 lg:order-1">
            {cards.map((card, index) => {
              const isActive = index === activeCard

              return (
                <button
                  key={index}
                  onClick={() => handleCardClick(index)}
                  className={`relative w-full p-5 text-left rounded-lg border transition-all duration-200 ${
                    isActive 
                      ? 'border-foreground/20 bg-card shadow-sm' 
                      : 'border-border hover:border-foreground/10 hover:bg-secondary/50'
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-border rounded-t-lg overflow-hidden">
                      <div
                        key={animationKey}
                        className="h-full bg-foreground"
                        style={{
                          animation: 'progressBar 5s linear forwards'
                        }}
                      />
                    </div>
                  )}
                  <h3 className="font-medium text-foreground">{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {card.description}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Image Preview */}
          <div className="flex-1 order-1 lg:order-2">
            <div className="aspect-[4/3] rounded-xl border border-border overflow-hidden bg-card shadow-lg">
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={`w-full h-full transition-opacity duration-300 ${
                    activeCard === index ? "opacity-100" : "opacity-0 absolute inset-0"
                  }`}
                >
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progressBar {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </section>
  )
}
