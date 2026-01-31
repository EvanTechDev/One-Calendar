"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { CalendarIcon, ArrowRight, Check } from 'lucide-react'
import DocumentationSection from "@/components/landing/documentation-section"
import FAQSection from "@/components/landing/faq-section"
import PricingSection from "@/components/landing/pricing-section"
import CTASection from "@/components/landing/cta-section"
import FooterSection from "@/components/landing/footer-section"

export default function LandingPage() {
  const [activeCard, setActiveCard] = useState(0)
  const [progress, setProgress] = useState(0)
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const mountedRef = useRef(true)
  const [showLoading, setShowLoading] = useState(false)
  const [loadingDots, setLoadingDots] = useState("")
  const [shouldRender, setShouldRender] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const progressInterval = setInterval(() => {
      if (!mountedRef.current) return
      setProgress((prev) => {
        if (prev >= 100) {
          if (mountedRef.current) {
            setActiveCard((current) => (current + 1) % 3)
          }
          return 0
        }
        return prev + 2
      })
    }, 100)

    return () => {
      clearInterval(progressInterval)
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleCardClick = (index: number) => {
    if (!mountedRef.current) return
    setActiveCard(index)
    setProgress(0)
  }

  useEffect(() => {
    const hasSkippedLanding = localStorage.getItem("skip-landing") === "true"
    if (hasSkippedLanding || (isLoaded && isSignedIn)) {
      setShowLoading(true)
      router.replace("/app")
    } else if (isLoaded) {
      setShouldRender(true)
    }
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (showLoading) {
      const interval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === "...") return "."
          return prev + "."
        })
      }, 400)
      return () => clearInterval(interval)
    }
  }, [showLoading])

  if (showLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <CalendarIcon className="h-16 w-16 text-foreground mb-4" />
        <p className="text-lg text-muted-foreground">
          Loading One Calendar{loadingDots}
        </p>
      </div>
    )
  }

  if (!shouldRender) return null

  const features = [
    {
      title: "Plan your schedules",
      description: "Intelligent scheduling that adapts to your workflow and keeps everything organized.",
    },
    {
      title: "Analytics & insights", 
      description: "Transform your calendar data into actionable insights with real-time analytics.",
    },
    {
      title: "Secure sharing",
      description: "Share schedules with password protection and burn-after-read security.",
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header - Vercel style sticky nav */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled ? 'glass-effect border-b border-border' : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/icon.svg" alt="One Calendar" width={28} height={28} />
              <span className="font-semibold text-foreground hidden sm:inline">One Calendar</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                href="/about" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-underline"
              >
                About
              </Link>
              <Link 
                href="#pricing" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-underline"
              >
                Pricing
              </Link>
              <Link 
                href="#faq" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors hover-underline"
              >
                FAQ
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Link 
              href="/sign-up"
              className="h-9 px-4 bg-foreground text-background rounded-md text-sm font-medium flex items-center justify-center hover:bg-foreground/90 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Vercel style */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-[800px] mx-auto text-center animate-fade-up">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground leading-[1.1] text-balance">
              Time-Saving AI Calendar
              <br />
              <span className="text-muted-foreground">Designed for Efficiency</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-[600px] mx-auto leading-relaxed">
              Simplify your schedule and securely store calendar data with intelligent, seamless automation.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/sign-up"
                className="h-12 px-8 bg-foreground text-background rounded-md text-base font-medium flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all group"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="/about"
                className="h-12 px-8 border border-border rounded-md text-base font-medium flex items-center justify-center hover:bg-secondary transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Product Preview */}
          <div className="mt-16 md:mt-24 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="relative max-w-[1000px] mx-auto">
              <div className="aspect-[16/10] rounded-xl border border-border overflow-hidden bg-card shadow-2xl shadow-black/5">
                <div className="relative w-full h-full">
                  {["/Banner.jpg", "/A.jpg", "/S.jpg"].map((src, index) => (
                    <div
                      key={src}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        activeCard === index ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <img
                        src={src}
                        alt={`Product screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature Tabs */}
          <div className="mt-12 max-w-[900px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <button
                  key={feature.title}
                  onClick={() => handleCardClick(index)}
                  className={`relative p-6 text-left rounded-lg border transition-all duration-200 ${
                    activeCard === index 
                      ? 'border-foreground/20 bg-card shadow-sm' 
                      : 'border-border hover:border-foreground/10 hover:bg-secondary/50'
                  }`}
                >
                  {activeCard === index && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-border rounded-t-lg overflow-hidden">
                      <div 
                        className="h-full bg-foreground transition-all duration-100 ease-linear"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                  <h3 className="font-medium text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Vercel Bento style */}
      <section className="py-24 border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-muted-foreground mb-4">FEATURES</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground text-balance">
              Built for clarity and focus
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-[600px] mx-auto">
              Stay focused with tools that organize, connect, and turn information into confident decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature Card 1 */}
            <div className="group p-8 rounded-xl border border-border bg-card hover:border-foreground/20 transition-all duration-200 hover:-translate-y-1">
              <div className="flex flex-col h-full">
                <h3 className="text-xl font-semibold text-foreground">Smart. Simple. Brilliant.</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Your data is beautifully organized so you see everything clearly without the clutter.
                </p>
                <div className="mt-8 flex-1 flex items-center justify-center rounded-lg bg-secondary/50 min-h-[200px]">
                  <div className="grid grid-cols-3 gap-3 p-6">
                    {[1,2,3,4,5,6].map((i) => (
                      <div key={i} className="w-16 h-16 rounded-lg bg-background border border-border" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Card 2 */}
            <div className="group p-8 rounded-xl border border-border bg-card hover:border-foreground/20 transition-all duration-200 hover:-translate-y-1">
              <div className="flex flex-col h-full">
                <h3 className="text-xl font-semibold text-foreground">Your personal AI assistant</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Every user can talk to our One AI and get fast, intelligent responses.
                </p>
                <div className="mt-8 flex-1 flex items-center justify-center rounded-lg bg-secondary/50 min-h-[200px]">
                  <div className="flex flex-col gap-3 p-6 w-full max-w-[280px]">
                    <div className="h-10 rounded-lg bg-background border border-border" />
                    <div className="h-10 rounded-lg bg-foreground/5 border border-border" />
                    <div className="h-10 rounded-lg bg-background border border-border" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <DocumentationSection />

      {/* Pricing Section */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* FAQ Section */}
      <div id="faq">
        <FAQSection />
      </div>

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <FooterSection />
    </div>
  )
}
