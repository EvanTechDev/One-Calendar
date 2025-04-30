"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
      
      {/* Gradient background effects */}
      <div className="fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-[300px] w-[300px] rounded-full bg-blue-300 dark:bg-blue-600 opacity-15 dark:opacity-20 blur-[100px]" />
        <div className="absolute right-1/3 bottom-1/3 h-[400px] w-[400px] rounded-full bg-purple-300 dark:bg-purple-600 opacity-15 dark:opacity-20 blur-[120px]" />
      </div>
      
      {/* Header/Navigation - Floating Nav Bar */}
      <header className="sticky top-6 z-50 px-4 mx-auto flex justify-center">
        <div className="w-130 max-w-4xl flex items-center rounded-xl px-2 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/10 dark:border-white/20">
          <div className="flex items-center gap-2 py-2 px-3">
            <Image src="/icon.svg" alt="One Calendar" width={24} height={24} />
            {/*<span className="font-semibold text-lg text-gray-900 dark:text-white">One Calendar</span>*/}
          </div>
          <nav className="hidden md:flex items-center gap-6 px-3 mr-25">
            <a href="/about" className="text-sm text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white">About</a>
            <a href="/resources" className="text-sm text-gray-700 hover:text-gray-900 dark:text-white/70 dark:hover:text-white flex items-center">
              Resources
              <span className="ml-1 inline-block w-1 h-1 bg-gray-700 dark:bg-white/70 rounded-full"></span>
            </a>
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
            <ExternalLinkIcon className="ml-2 h-4 w-4 text-gray-700 dark:text-white/70" />
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#02E8FF] to-[#0066ff]">
            AI Powered Calendar,<br />Built to Save You Time
          </h1>
          <p className="text-xl text-gray-700 dark:text-white/70 max-w-2xl mx-auto mb-6 font-medium">
            One Calendar is an AI native calendar that manages your schedule.
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
                <p className="text-gray-700 dark:text-white/70 mb-6">
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
      
      {/* CTA Section - Improved Background */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 dark:text-white">Ready to transform your scheduling?</h2>
            <p className="text-xl text-gray-700 dark:text-white/70 mb-8 max-w-2xl mx-auto">
              Join thousands of users who've streamlined their calendar management with One Calendar.
            </p>
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl px-8 py-6 text-lg"
            >
              Get Started Now
            </Button>
          </div>
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
            <a href="https://github.com/Dev-Huang1/One-Calendar" target="_blank" rel="noopener" className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white">
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
