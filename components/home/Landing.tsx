"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { GithubIcon, CloudIcon, Share2Icon, BarChart3Icon, SunIcon, KeyboardIcon, ImportIcon, ExternalLinkIcon, MoonIcon } from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const [shouldRender, setShouldRender] = useState(false)
  const [activeFeature, setActiveFeature] = useState("cloud")

  useEffect(() => {
    const hasSkippedLanding = localStorage.getItem("skip-landing") === "true"
    if (hasSkippedLanding || (isLoaded && isSignedIn)) {
      router.replace("/app")
    } else if (isLoaded) {
      setShouldRender(true)
    }
  }, [isLoaded, isSignedIn, router])

  const handleGetStarted = () => {
    localStorage.setItem("skip-landing", "true")
    router.push("/app")
  }

  if (!shouldRender) return null

  return (
    <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
      {/* Background Pattern */}
      <div className="fixed -z-10 inset-0">
        <div className="absolute inset-0 bg-white dark:bg-black">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0, 0, 0, 0.1) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
          <div className="absolute inset-0 dark:block hidden" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />
        </div>
      </div>
      
      {/* Header/Navigation - Floating Nav Bar */}
      <header className="sticky top-6 z-50 px-4 mx-auto flex justify-center">
        <div className="w-auto max-w-4xl flex items-center justify-between rounded-xl px-2 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/20">
          <div className="flex items-center gap-2 py-2 px-3">
            <Image src="/icon.svg" alt="One Calendar" width={24} height={24} />
            {/*<span className="font-semibold text-lg text-gray-900 dark:text-white">One Calendar</span>*/}
          </div>
          <nav className="hidden md:flex items-center gap-6 px-3 mr-20">
            <a href="/about" className="text-sm text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white">About</a>
            <div className="relative group">
        <a href="#" className="text-sm text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white flex items-center">
          Resources
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 ml-1 text-gray-500 dark:text-gray-400 transition-transform duration-200 group-hover:rotate-180" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </a>

        <div className="absolute left-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-1 group-hover:translate-y-0">
          <div className="py-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700">
            <a href="https://github.com/EvanTechDev/One-Calendar" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="text-sm text-gray-700 dark:text-white/70">GitHub</span>
            </a>
            <a href="https://x.com/One__Cal" target="_blank" rel="noopener noreferrer" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
              </svg>
              <span className="text-sm text-gray-700 dark:text-white/70">X</span>
            </a>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <a href="/privacy" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
              <span className="text-sm text-gray-700 dark:text-white/70">Privacy Policy</span>
            </a>
            <a href="/terms" className="flex items-center px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <span className="text-sm text-gray-700 dark:text-white/70">Terms of Service</span>
            </a>
          </div>
        </div>
      </div>
          </nav>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10"
              onClick={() => router.push("/sign-in")}
            >
              Sign in
            </Button>
            <Button
              onClick={handleGetStarted}
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="py-24 px-2">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center py-1 px-3 rounded-full border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/5 backdrop-blur-sm mb-8">
            <span className="text-sm text-gray-700 dark:text-white/70">AI Powered</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight mb-6 bg-clip-text text-transparent bg-black">{/*bg-gradient-to-r from-[#02E8FF] to-[#0066ff]*/}
            Time-Saving AI Calendar,<br />Designed for Efficiency
          </h1>
          <p className="text-xl text-gray-700 dark:text-white/70 max-w-2xl mx-auto mb-6 font-medium">
            One Calendar is an AI-first app that streamlines your scheduling.
          </p>
          <div className="flex justify-center mb-16">
            <Button
              onClick={handleGetStarted}
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl"
            >
              Get Started
            </Button>
          </div>
          <div className="rounded-lg overflow-hidden border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/5 backdrop-blur-md shadow-2xl max-w-4xl mx-auto">
            <Image
              src="/Banner.jpg"
              alt="One Calendar Preview"
              width={1200}
              height={675}
              className="w-full object-cover"
            />
          </div>
        </div>
      </section>
      
      {/* Features Tabs Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="cloud" className="w-full" onValueChange={setActiveFeature}>
            <div className="flex justify-center mb-12">
              <TabsList className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/20 backdrop-blur-md">
                <TabsTrigger value="cloud" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <CloudIcon className="h-4 w-4 mr-2" />
                  Cloud Sync
                </TabsTrigger>
                <TabsTrigger value="sharing" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <Share2Icon className="h-4 w-4 mr-2" />
                  Sharing
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <BarChart3Icon className="h-4 w-4 mr-2" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="weather" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <SunIcon className="h-4 w-4 mr-2" />
                  Weather
                </TabsTrigger>
                <TabsTrigger value="shortcuts" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <KeyboardIcon className="h-4 w-4 mr-2" />
                  Shortcuts
                </TabsTrigger>
                <TabsTrigger value="import" className="data-[state=active]:bg-black/10 dark:data-[state=active]:bg-white/10">
                  <ImportIcon className="h-4 w-4 mr-2" />
                  Import
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <TabsContent value="cloud" className="mt-0">
                <Badge className="mb-4 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 hover:bg-blue-500/30 border-none">Cloud Technology</Badge>
                <h2 className="text-3xl font-bold mb-4">Cloud Sync</h2>
                <p className="text-gray-700 dark:text-white/70">
                  Access your events from anywhere with secure cloud storage. Your calendar stays in sync across all your devices.
                </p>
              </TabsContent>
              <TabsContent value="sharing" className="mt-0">
                <Badge className="mb-4 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 hover:bg-green-500/30 border-none">Collaboration</Badge>
                <h2 className="text-3xl font-bold mb-4">Easy Sharing</h2>
                <p className="text-gray-700 dark:text-white/70">
                  Collaborate and share your schedule with ease. Perfect for team coordination and family planning.
                </p>
              </TabsContent>
              <TabsContent value="analytics" className="mt-0">
                <Badge className="mb-4 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-500/30 border-none">Insights</Badge>
                <h2 className="text-3xl font-bold mb-4">Analytics</h2>
                <p className="text-gray-700 dark:text-white/70">
                  Gain insights with smart event tracking and summaries. Understand how you spend your time.
                </p>
              </TabsContent>
              <TabsContent value="weather" className="mt-0">
                <Badge className="mb-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-500/30 border-none">Forecasting</Badge>
                <h2 className="text-3xl font-bold mb-4">Weather Integration</h2>
                <p className="text-gray-700 dark:text-white/70">
                  See real-time weather in your calendar view. Plan outdoor events with confidence.
                </p>
              </TabsContent>
              <TabsContent value="shortcuts" className="mt-0">
                <Badge className="mb-4 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 hover:bg-red-500/30 border-none">Productivity</Badge>
                <h2 className="text-3xl font-bold mb-4">Keyboard Shortcuts</h2>
                <p className="text-gray-700 dark:text-white/70">
                  Navigate quickly using customizable shortcuts. Work efficiently without touching your mouse.
                </p>
              </TabsContent>
              <TabsContent value="import" className="mt-0">
                <Badge className="mb-4 bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 hover:bg-pink-500/30 border-none">Data Transfer</Badge>
                <h2 className="text-3xl font-bold mb-4">Import & Export</h2>
                <p className="text-gray-700 dark:text-white/70">
                  Easily move data in and out of One Calendar. Compatible with all standard calendar formats.
                </p>
              </TabsContent>
              <div className="order-first md:order-last relative">
                <div className="aspect-video rounded-lg overflow-hidden border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/5 backdrop-blur-md flex items-center justify-center relative">
                  {activeFeature === "cloud" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-200/70 to-purple-200/70 dark:from-blue-500/20 dark:to-purple-500/20 opacity-30" />
                      <CloudIcon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                  {activeFeature === "sharing" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-200/70 to-blue-200/70 dark:from-green-500/20 dark:to-blue-500/20 opacity-30" />
                      <Share2Icon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                  {activeFeature === "analytics" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-200/70 to-blue-200/70 dark:from-purple-500/20 dark:to-blue-500/20 opacity-30" />
                      <BarChart3Icon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                  {activeFeature === "weather" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/70 to-orange-200/70 dark:from-yellow-500/20 dark:to-orange-500/20 opacity-30" />
                      <SunIcon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                  {activeFeature === "shortcuts" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-200/70 to-purple-200/70 dark:from-red-500/20 dark:to-purple-500/20 opacity-30" />
                      <KeyboardIcon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                  {activeFeature === "import" && (
                    <div className="p-4 w-full h-full flex items-center justify-center">
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-200/70 to-blue-200/70 dark:from-pink-500/20 dark:to-blue-500/20 opacity-30" />
                      <ImportIcon className="h-20 w-20 text-black/30 dark:text-white/30" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-3 -right-3 h-24 w-24 bg-blue-300/30 dark:bg-blue-500/30 rounded-full blur-3xl" />
                <div className="absolute -top-3 -left-3 h-16 w-16 bg-purple-300/30 dark:bg-purple-500/30 rounded-full blur-2xl" />
              </div>
            </div>
          </Tabs>
        </div>
      </section>
      
      {/* Original Features Grid Section */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <CloudIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Cloud Sync</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">Access your events from anywhere with secure cloud storage.</p>
              </CardContent>
            </Card>
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <Share2Icon className="h-8 w-8 text-green-600 dark:text-green-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Easy Sharing</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">Collaborate and share your schedule with ease.</p>
              </CardContent>
            </Card>
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <BarChart3Icon className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Analytics</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">Gain insights with smart event tracking and summaries.</p>
              </CardContent>
            </Card>
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <SunIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Weather Integration</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">See real-time weather in your calendar view.</p>
              </CardContent>
            </Card>
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <KeyboardIcon className="h-8 w-8 text-red-600 dark:text-red-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Keyboard Shortcuts</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">Navigate quickly using customizable shortcuts.</p>
              </CardContent>
            </Card>
            <Card className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 backdrop-blur-md hover:bg-opacity-10 transition-all duration-300">
              <CardContent className="p-6">
                <ImportIcon className="h-8 w-8 text-pink-600 dark:text-pink-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Import & Export</h3>
                <p className="text-gray-700 dark:text-white/70 text-sm">Easily move data in and out of One Calendar.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Powered By Section - Improved */}
<section className="py-16 px-4 border-t border-black/10 dark:border-white/10">
  <div className="max-w-4xl mx-auto">
    <h2 className="text-3xl font-medium text-center mb-10 dark:text-white">Technical support</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-10 items-center justify-items-center">
      {/* Vercel */}
      <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex flex-col items-center">
        <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" id="vercel">
<style>
#vercel {
    rect {fill: #15191C}
    path {fill: #F4F2ED}

    @media (prefers-color-scheme: light) {
        rect {fill: #F4F2ED}
        path {fill: #15191C}
    }
}
</style>
<rect width="256" height="256" rx="25" fill="#15191C"/>
<path d="M208 198.333H48L128 58L208 198.333Z" fill="#F4F2ED"/>
</svg>
        <span className="mt-3 text-base font-medium text-gray-800 dark:text-gray-200">Vercel</span>
      </a>
      
      {/* Clerk */}
      <a href="https://clerk.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex flex-col items-center">
        <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" id="clerk">
<style>
#clerk {
    rect {fill: #15191C}

    @media (prefers-color-scheme: light) {
        rect {fill: #F4F2ED}
    }
}
</style>
<rect width="256" height="256" rx="25" fill="#15191C"/>
<path d="M138.21 153.901C152.398 153.901 163.9 142.398 163.9 128.21C163.9 114.022 152.398 102.519 138.21 102.519C124.021 102.519 112.519 114.022 112.519 128.21C112.519 142.398 124.021 153.901 138.21 153.901Z" fill="#6C47FF"/>
<path d="M183.903 59.8575C186.471 61.5778 186.69 65.1965 184.505 67.3823L165.73 86.1567C164.034 87.8535 161.401 88.1215 159.266 87.0275C152.95 83.7921 145.793 81.9668 138.21 81.9668C112.671 81.9668 91.9668 102.671 91.9668 128.21C91.9668 135.793 93.7921 142.95 97.0275 149.266C98.1215 151.401 97.8535 154.034 96.1567 155.73L77.3823 174.505C75.1965 176.69 71.5778 176.471 69.8575 173.903C61.1049 160.836 56 145.119 56 128.21C56 82.8066 92.8066 46 138.21 46C155.119 46 170.836 51.1049 183.903 59.8575Z" fill="#BAB1FF"/>
<path d="M184.505 189.038C186.691 191.223 186.471 194.842 183.903 196.562C170.836 205.315 155.119 210.42 138.21 210.42C121.301 210.42 105.584 205.315 92.517 196.562C89.9488 194.842 89.7293 191.223 91.9151 189.038L110.689 170.263C112.386 168.566 115.019 168.298 117.154 169.392C123.47 172.628 130.627 174.453 138.21 174.453C145.793 174.453 152.95 172.628 159.266 169.392C161.401 168.298 164.034 168.566 165.731 170.263L184.505 189.038Z" fill="#6C47FF"/>
</svg>
        <span className="mt-3 text-base font-medium text-gray-800 dark:text-gray-200">Clerk</span>
      </a>

      {/* Groq */}
      <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex flex-col items-center">
        <?xml version="1.0" encoding="utf-8" ?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26.3 26.3"><defs><style>.cls-1{fill:#f05237;}.cls-2{fill:#fff;}</style></defs><g id="Layer_2" data-name="Layer 2"><g id="Content"><circle class="cls-1" cx="13.15" cy="13.15" r="13.15"/><path class="cls-2" d="M13.17,6.88a4.43,4.43,0,0,0,0,8.85h1.45V14.07H13.17a2.77,2.77,0,1,1,2.77-2.76v4.07a2.74,2.74,0,0,1-4.67,2L10.1,18.51a4.37,4.37,0,0,0,3.07,1.29h.06a4.42,4.42,0,0,0,4.36-4.4V11.2a4.43,4.43,0,0,0-4.42-4.32"/></g></g></svg>
        <span className="mt-3 text-base font-medium text-gray-800 dark:text-gray-200">Groq</span>
      </a>

      {/* OpenWeather */}
      <a href="https://openweathermap.org" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition-opacity flex flex-col items-center">
        <svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" id="openweather">
<style>
#openweather {
    rect {fill: #15191C}

    @media (prefers-color-scheme: light) {
        rect {fill: #F4F2ED}
    }
}
</style>
<rect width="256" height="256" rx="25" fill="#15191C"/>
<path d="M196.295 138.936C194.345 138.857 192.378 138.936 190.411 138.936C182.417 138.936 182.417 138.936 182.593 130.822C182.935 121.437 181.243 112.089 177.634 103.419C174.024 94.7475 168.582 86.9579 161.68 80.5831V80.5032L160.241 79.2253C153.053 72.9251 144.569 68.276 135.387 65.6054C126.205 62.9349 116.549 62.3077 107.099 63.7682C97.6487 65.2287 88.6336 68.7412 80.6886 74.0585C72.7436 79.3758 66.0619 86.3686 61.114 94.5445L61.002 94.7202C60.6663 95.2953 60.3145 95.8703 59.9948 96.4454C53.6274 107.696 50.7608 120.587 51.7608 133.473C51.8887 135.614 53.3596 138.777 49.0108 139.08C45.2536 139.336 42.4396 141.205 43.0951 145.47C43.7507 149.735 47.0283 150.262 50.6896 150.262C56.3654 150.15 62.0573 150.262 67.7331 150.262C71.3785 150.262 74.0005 151.732 74.1284 155.582C74.2404 159.064 72.018 160.997 68.5805 161.045C64.3116 161.045 61.5297 163.009 61.8654 167.306C62.2012 171.604 65.7186 172.099 69.3479 172.003C79.5325 171.923 89.717 171.907 99.9176 172.003C103.675 172.003 106.457 173.6 106.233 177.961C106.025 181.939 103.451 183.201 99.8376 183.185C93.5702 183.185 87.3028 183.185 81.0194 183.185C77.0383 183.185 73.1372 183.392 73.1212 188.616C73.1052 193.839 77.0543 194.015 81.0194 193.999C102.188 193.999 123.356 193.999 144.509 193.999C153.718 193.999 162.927 193.999 172.137 193.999C175.878 193.999 178.98 193.312 179.092 188.856C179.22 184.063 175.894 183.105 171.993 183.201C170.394 183.201 168.795 183.201 167.292 183.201H139.073C135.38 183.201 132.933 181.603 132.822 177.77C132.71 173.936 135.252 172.274 138.833 172.019C140 171.923 141.183 172.019 142.351 172.019C145.932 172.019 149.273 171.619 149.561 167.099C149.881 162.307 146.683 161.172 142.718 161.156C139.105 160.965 137.01 158.856 137.01 155.661C137.01 152.035 139.393 150.07 143.214 150.182C145.564 150.182 147.93 150.182 150.281 150.182C165.566 150.182 180.85 150.182 196.135 150.182C199.988 150.182 202.754 148.968 202.882 144.671C203.01 140.374 199.972 139.096 196.295 138.936Z" fill="#EB6D4A"/>
<path d="M194.017 171.89C196.994 171.89 199.408 169.478 199.408 166.504C199.408 163.53 196.994 161.118 194.017 161.118C191.04 161.118 188.627 163.53 188.627 166.504C188.627 169.478 191.04 171.89 194.017 171.89Z" fill="#EB6D4A"/>
<path d="M207.61 171.89C210.587 171.89 213 169.478 213 166.504C213 163.53 210.587 161.118 207.61 161.118C204.633 161.118 202.219 163.53 202.219 166.504C202.219 169.478 204.633 171.89 207.61 171.89Z" fill="#EB6D4A"/>
<path d="M207.946 161.118H193.466V171.89H207.946V161.118Z" fill="#EB6D4A"/>
<path d="M162.257 171.89C165.234 171.89 167.647 169.478 167.647 166.504C167.647 163.53 165.234 161.118 162.257 161.118C159.28 161.118 156.866 163.53 156.866 166.504C156.866 169.478 159.28 171.89 162.257 171.89Z" fill="#EB6D4A"/>
<path d="M175.849 171.89C178.826 171.89 181.24 169.478 181.24 166.504C181.24 163.53 178.826 161.118 175.849 161.118C172.872 161.118 170.459 163.53 170.459 166.504C170.459 169.478 172.872 171.89 175.849 171.89Z" fill="#EB6D4A"/>
<path d="M176.185 161.118H161.705V171.89H176.185V161.118Z" fill="#EB6D4A"/>
</svg>
        <span className="mt-3 text-base font-medium text-gray-800 dark:text-gray-200">OpenWeather</span>
      </a>
    </div>
  </div>
</section>
      
      {/* CTA Section - Improved Background */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-medium mb-6 dark:text-white">Ready to transform your scheduling?</h2>
            <p className="text-xl text-gray-700 dark:text-white/70 mb-8 max-w-2xl mx-auto">
              Join thousands of users who've streamlined their calendar management with One Calendar.
            </p>
            <Button
              onClick={handleGetStarted}
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl"
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
<section className="py-16 px-4 relative overflow-hidden">
  <div className="max-w-3xl mx-auto">
    <h2 className="text-3xl font-medium mb-10 text-center dark:text-white">FAQ</h2>
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">What's One Calendar?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          One Calendar is an AI-driven calendar app designed to simplify your schedule and manage your time with smart features and a user-friendly interface.
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="item-2" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">How do I import my existing calendar?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          One Calendar supports importing data from Apple Calendar, Outlook and Google Calendar. Just download your calendar ics file in their settings and go to One Calendar's analysis page to import it.
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="item-3" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">How do I share my schedule with others?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          With our sharing feature, you can easily share specific events with family, friends or colleagues. Let others import events, etc.
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="item-4" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">What analytical features does One Calendar provide?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          Our analytics can help you understand how you spend your time, provide insights into your most productive day and most productive hours, and identify patterns that can improve efficiency. These insights can help you plan and optimize your schedule more intelligently.
        </AccordionContent>
      </AccordionItem>
      
      <AccordionItem value="item-5" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">Is there a free plan available?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          Of course! One Calendar supports free use, our product is free and open-sourced. Suitable for any user, we also provide support, you can contact us to get it.
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="item-6" className="border-b border-black/10 dark:border-white/10">
        <AccordionTrigger className="py-4 text-left hover:no-underline">
          <span className="text-lg font-medium">How to report a problem or request a feature?</span>
        </AccordionTrigger>
        <AccordionContent className="pb-4 text-gray-700 dark:text-white/70">
          You can open a new issus on our Github page or on our feedback to feedback or request features.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</section>
      
      {/* Original Footer */}
      <footer className="mt-auto py-8 border-t border-black/10 dark:border-white/10 text-gray-600 dark:text-white/70 text-sm px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2025 One Calendar. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/about" className="hover:text-gray-900 dark:hover:text-white">About</a>
            <a href="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms</a>
            <a href="https://github.com/EvanTechDev/One-Calendar" target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
              <GithubIcon className="w-4 h-4" />
            </a>
            <a href="https://x.com/One__Cal" target="_blank" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 32 32">
                <path d="M 4.0175781 4 L 13.091797 17.609375 L 4.3359375 28 L 6.9511719 28 L 14.246094 19.34375 L 20.017578 28 L 20.552734 28 L 28.015625 28 L 18.712891 14.042969 L 27.175781 4 L 24.560547 4 L 17.558594 12.310547 L 12.017578 4 L 4.0175781 4 z M 7.7558594 6 L 10.947266 6 L 24.279297 26 L 21.087891 26 L 7.7558594 6 z"></path>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
