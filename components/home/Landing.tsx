"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { 
  GithubIcon, CloudIcon, Share2Icon, BarChart3Icon, SunIcon, 
  KeyboardIcon, ImportIcon, CalendarIcon, ArrowRight, CheckCircle2,
  Sparkles, Zap, Lock, Bell, RefreshCw, Star, Users
} from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  const router = useRouter()
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [activeFeature, setActiveFeature] = useState("cloud")
  const [scrollY, setScrollY] = useState(0)

  /*useEffect(() => {
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
        setLoadingDots(prev => prev === "..." ? "." : prev + ".")
      }, 400)
      return () => clearInterval(interval)
    }
  }, [showLoading])*/

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleGetStarted = () => {
    router.push("/app")
  }

  /*if (showLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse" />
          <CalendarIcon className="h-24 w-24 text-[#0066ff] relative z-10" />
        </div>
        <p className="text-lg text-gray-700 dark:text-white mt-6">
          Loading One Calendar{loadingDots}
        </p>
      </div>
    )
  }

  if (!shouldRender) return null*/

  const stats = [
    { value: "50K+", label: "Active Users" },
    { value: "1M+", label: "Events Created" },
    { value: "99.9%", label: "Uptime" },
    { value: "24/7", label: "Support" }
  ]

  const testimonials = [
    { name: "Sarah Chen", role: "Product Manager", text: "One Calendar transformed how our team coordinates. The AI features are incredible!", avatar: "SC" },
    { name: "Michael Rodriguez", role: "Entrepreneur", text: "Best calendar app I've used. Clean, fast, and actually intelligent.", avatar: "MR" },
    { name: "Emily Watson", role: "Designer", text: "The interface is beautiful and the features are exactly what I needed.", avatar: "EW" }
  ]

  const integrations = [
    { name: "Google Calendar", icon: "🗓️" },
    { name: "Outlook", icon: "📧" },
    { name: "Apple Calendar", icon: "🍎" },
    { name: "Zoom", icon: "🎥" },
    { name: "Slack", icon: "💬" },
    { name: "Teams", icon: "👥" }
  ]

  return (
    <div className="flex flex-col min-h-screen text-gray-900 dark:text-white relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-white dark:bg-black" />
        <div 
          className="absolute w-96 h-96 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl transition-all duration-300"
          style={{
            left: `${mousePosition.x - 192}px`,
            top: `${mousePosition.y - 192}px`,
          }}
        />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.05) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="absolute inset-0 dark:block hidden" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Floating Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-blue-500/30 rounded-full animate-pulse" />
        <div className="absolute top-40 right-20 w-3 h-3 bg-purple-500/30 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }} />
        <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-pink-500/30 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
      </div>
      
      {/* Header */}
      <header className={`sticky z-50 px-4 mx-auto flex justify-center transition-all duration-300 ${scrollY > 50 ? 'top-4' : 'top-6'}`}>
        <div className="w-auto max-w-6xl flex items-center justify-between rounded-2xl px-4 py-2 bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-black/10 dark:border-white/20 shadow-lg">
          <div className="flex items-center gap-3 py-2 px-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-lg" />
              <Image src="/icon.svg" alt="One Calendar" width={28} height={28} className="relative z-10" />
            </div>
            <span className="font-semibold text-lg hidden sm:block">One Calendar</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 px-3">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white transition-colors">Features</a>
            <a href="#integrations" className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white transition-colors">Integrations</a>
            <a href="#testimonials" className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white transition-colors">Testimonials</a>
            <div className="relative group">
              <a href="#" className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white flex items-center transition-colors">
                Resources
                <svg className="h-4 w-4 ml-1 transition-transform duration-200 group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </a>
              <div className="absolute left-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
                <div className="py-2 rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
                  <a href="https://github.com/EvanTechDev/One-Calendar" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <GithubIcon className="w-5 h-5 mr-3" />
                    <span className="text-sm font-medium">GitHub</span>
                  </a>
                  <a href="https://x.com/One__Cal" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                    </svg>
                    <span className="text-sm font-medium">X (Twitter)</span>
                  </a>
                  <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                  <a href="/privacy" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Lock className="w-5 h-5 mr-3" />
                    <span className="text-sm font-medium">Privacy Policy</span>
                  </a>
                  <a href="/terms" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span className="text-sm font-medium">Terms of Service</span>
                  </a>
                </div>
              </div>
            </div>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 rounded-xl"
              onClick={() => router.push("/sign-in")}
            >
              Sign in
            </Button>
            <Button
              onClick={handleGetStarted}
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl shadow-lg hover:shadow-xl transition-all group"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-32 px-4 relative">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              AI Powered Calendar
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Time-Saving AI Calendar,
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Designed for Efficiency
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-white/60 max-w-3xl mx-auto mb-8 leading-relaxed">
            One Calendar is an AI-first app that streamlines your scheduling with intelligent automation and beautiful design.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl shadow-xl hover:shadow-2xl transition-all group text-lg px-8 py-6"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-2 border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-lg px-8 py-6"
            >
              Watch Demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20 max-w-4xl mx-auto">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-white/60 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          
          {/* Hero Image */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-black via-transparent to-transparent z-10" />
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl opacity-50" />
            <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/20 bg-gradient-to-br from-white/50 to-gray-100/50 dark:from-white/5 dark:to-transparent backdrop-blur-xl shadow-2xl relative z-10">
              <Image
                src="/Banner.jpg"
                alt="One Calendar Preview"
                width={1200}
                height={675}
                className="w-full object-cover dark:hidden"
              />
              <Image
                src="/Banner-dark.jpg"
                alt="One Calendar Preview - Dark"
                width={1200}
                height={675}
                className="w-full object-cover hidden dark:block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-none px-4 py-1">
              Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything you need</h2>
            <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
              Powerful features that make scheduling effortless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CloudIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Cloud Sync</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Access your events from anywhere with secure cloud storage</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Share2Icon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Easy Sharing</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Collaborate and share your schedule with ease</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BarChart3Icon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Analytics</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Gain insights with smart event tracking</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <SunIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Weather Integration</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">See real-time weather in your calendar</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <KeyboardIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Keyboard Shortcuts</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Navigate quickly with customizable shortcuts</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ImportIcon className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Import & Export</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Easily move data in and out</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Smart Reminders</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">AI-powered notifications at the right time</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Lock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Privacy First</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Your data is encrypted and secure</p>
              </CardContent>
            </Card>

            <Card className="group bg-white/50 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <RefreshCw className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Auto Sync</h3>
                <p className="text-gray-600 dark:text-white/60 text-sm leading-relaxed">Real-time synchronization across devices</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive Features Tabs */}
      <section className="py-24 px-4 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="cloud" className="w-full" onValueChange={setActiveFeature}>
            <div className="flex justify-center mb-12">
              <TabsList className="bg-white/80 dark:bg-white/5 border border-black/10 dark:border-white/20 backdrop-blur-xl p-1 rounded-2xl shadow-lg">
                <TabsTrigger value="cloud" className="data-[state=active]:bg-black/5 dark:data-[state=active]:bg-white/10 rounded-xl">
                  <CloudIcon className="h-4 w-4 mr-2" />
                  Cloud Sync
                </TabsTrigger>
                <TabsTrigger value="sharing" className="data-[state=active]:bg-black/5 dark:data-[state=active]:bg-white/10 rounded-xl">
                  <Share2Icon className="h-4 w-4 mr-2" />
                  Sharing
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-black/5 dark:data-[state=active]:bg-white/10 rounded-xl">
                  <BarChart3Icon className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <TabsContent value="cloud" className="mt-0">
                  <Badge className="mb-4 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-none">
                    Cloud Technology
                  </Badge>
                  <h2 className="text-3xl font-bold mb-4">Sync Everywhere</h2>
                  <p className="text-gray-600 dark:text-white/60 mb-6 leading-relaxed">
                    Access your events from anywhere with secure cloud storage. Your calendar stays in perfect sync across all your devices.
                  </p>
                  <ul className="space-y-3">
                    {["Instant synchronization", "End-to-end encryption", "Offline access", "Automatic backups"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="text-gray-700 dark:text-white/70">{item}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                
                <TabsContent value="sharing" className="mt-0">
                  <Badge className="mb-4 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 border-none">
                    Collaboration
                  </Badge>
                  <h2 className="text-3xl font-bold mb-4">Share Effortlessly</h2>
                  <p className="text-gray-600 dark:text-white/60 mb-6 leading-relaxed">
                    Collaborate with team members and share schedules with family. Coordination has never been easier.
                  </p>
                  <ul className="space-y-3">
                    {["Share specific events", "Team calendars", "Permission controls", "Real-time updates"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="text-gray-700 dark:text-white/70">{item}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                
                <TabsContent value="analytics" className="mt-0">
                  <Badge className="mb-4 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-none">
                    Insights
                  </Badge>
                  <h2 className="text-3xl font-bold mb-4">Track Your Time</h2>
                  <p className="text-gray-600 dark:text-white/60 mb-6 leading-relaxed">
                    Understand how you spend your time with powerful analytics and actionable insights.
                  </p>
                  <ul className="space-y-3">
                    {["Time tracking", "Productivity metrics", "Custom reports", "AI suggestions"].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <span className="text-gray-700 dark:text-white/70">{item}</span>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              </div>
              
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl opacity-50" />
                <div className="aspect-video rounded-2xl overflow-hidden border border-black/10 dark:border-white/20 bg-gradient-to-br from-white/50 to-gray-100/50 dark:from-white/5 dark:to-transparent backdrop-blur-xl shadow-2xl relative">
                  {activeFeature === "cloud" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-200/50 to-purple-200/50 dark:from-blue-500/10 dark:to-purple-500/10" />
                      <CloudIcon className="h-24 w-24 text-blue-600/30 dark:text-blue-400/30 relative z-10" />
                    </div>
                  )}
                  {activeFeature === "sharing" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-200/50 to-blue-200/50 dark:from-green-500/10 dark:to-blue-500/10" />
                      <Share2Icon className="h-24 w-24 text-green-600/30 dark:text-green-400/30 relative z-10" />
                    </div>
                  )}
                  {activeFeature === "analytics" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-200/50 to-pink-200/50 dark:from-purple-500/10 dark:to-pink-500/10" />
                      <BarChart3Icon className="h-24 w-24 text-purple-600/30 dark:text-purple-400/30 relative z-10" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Tabs>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-24 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <Badge className="mb-4 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-none px-4 py-1">
            Integrations
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Works with your favorites</h2>
          <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto mb-12">
            Seamlessly integrate with the tools you already use
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {integrations.map((integration, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 backdrop-blur-md hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{integration.icon}</div>
                <div className="text-sm font-medium text-gray-700 dark:text-white/70">{integration.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-none px-4 py-1">
              Testimonials
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Loved by thousands</h2>
            <p className="text-xl text-gray-600 dark:text-white/60 max-w-2xl mx-auto">
              See what our users have to say
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <Card key={i} className="bg-white/80 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 dark:text-white/70 mb-6 leading-relaxed">{testimonial.text}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{testimonial.name}</div>
                      <div className="text-xs text-gray-600 dark:text-white/60">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border-none px-4 py-1">
              FAQ
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Common questions</h2>
            <p className="text-xl text-gray-600 dark:text-white/60">
              Everything you need to know about One Calendar
            </p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="border border-black/10 dark:border-white/10 rounded-2xl px-6 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <span className="text-lg font-semibold">What's One Calendar?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-gray-600 dark:text-white/60 leading-relaxed">
                One Calendar is an AI-driven calendar app designed to simplify your schedule and manage your time with smart features and a user-friendly interface.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border border-black/10 dark:border-white/10 rounded-2xl px-6 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <span className="text-lg font-semibold">How do I import my existing calendar?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-gray-600 dark:text-white/60 leading-relaxed">
                One Calendar supports importing data from Apple Calendar, Outlook and Google Calendar. Just download your calendar ics file in their settings and go to One Calendar's analysis page to import it.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border border-black/10 dark:border-white/10 rounded-2xl px-6 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <span className="text-lg font-semibold">How do I share my schedule with others?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-gray-600 dark:text-white/60 leading-relaxed">
                With our sharing feature, you can easily share specific events with family, friends or colleagues. Let others import events and collaborate seamlessly.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border border-black/10 dark:border-white/10 rounded-2xl px-6 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <span className="text-lg font-semibold">What analytical features does One Calendar provide?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-gray-600 dark:text-white/60 leading-relaxed">
                Our analytics help you understand how you spend your time, provide insights into your most productive day and hours, and identify patterns to improve efficiency.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border border-black/10 dark:border-white/10 rounded-2xl px-6 bg-white/50 dark:bg-white/5 backdrop-blur-md">
              <AccordionTrigger className="py-4 text-left hover:no-underline">
                <span className="text-lg font-semibold">Is there a free plan available?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-gray-600 dark:text-white/60 leading-relaxed">
                Yes! One Calendar is free and open-source. We also provide premium support options if you need additional assistance.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center p-16 rounded-3xl bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/20 backdrop-blur-xl shadow-2xl">
            <div className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium">Start Your Journey</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to transform your scheduling?
            </h2>
            <p className="text-xl text-gray-600 dark:text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join thousands of users who've streamlined their calendar management with One Calendar.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                onClick={handleGetStarted}
                size="lg"
                className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl shadow-xl hover:shadow-2xl transition-all group text-lg px-8 py-6"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-2 border-gray-300 dark:border-white/20 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-lg px-8 py-6"
              >
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="mt-auto py-12 border-t border-black/10 dark:border-white/10 px-6 bg-gray-50/50 dark:bg-white/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/icon.svg" alt="One Calendar" width={24} height={24} />
                <span className="font-bold text-lg">One Calendar</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-white/60">
                AI-powered calendar designed for efficiency.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-white/60">
                <li><a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">Features</a></li>
                <li><a href="#integrations" className="hover:text-gray-900 dark:hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#testimonials" className="hover:text-gray-900 dark:hover:text-white transition-colors">Testimonials</a></li>
                <li><a href="/pricing" className="hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-white/60">
                <li><a href="/about" className="hover:text-gray-900 dark:hover:text-white transition-colors">About</a></li>
                <li><a href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">Terms</a></li>
                <li><a href="/contact" className="hover:text-gray-900 dark:hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Connect</h3>
              <div className="flex gap-4">
                <a href="https://github.com/EvanTechDev/One-Calendar" target="_blank" rel="noopener" className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  <GithubIcon className="w-5 h-5" />
                </a>
                <a href="https://x.com/One__Cal" target="_blank" className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-black/10 dark:border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-600 dark:text-white/60">
            <p>&copy; 2025 One Calendar. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span>Made with</span>
              <span className="text-red-500">❤️</span>
              <span>by the One Calendar team</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
