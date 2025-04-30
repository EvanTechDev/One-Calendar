"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { GithubIcon, CloudIcon, Share2Icon, BarChart3Icon, SunIcon, KeyboardIcon, ImportIcon, ArrowRightIcon } from "lucide-react"
import Image from "next/image"

export default function LandingPage() {
  const router = useRouter()
  const { isLoaded, isSignedIn } = useUser()
  const [shouldRender, setShouldRender] = useState(false)
  const [activeTab, setActiveTab] = useState("cloud")

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
    <div className="flex flex-col min-h-screen bg-white text-black">
      {/* Header/Navigation */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600">One Calendar</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="/about" className="text-gray-600 hover:text-blue-600">About</a>
              <a href="/pricing" className="text-gray-600 hover:text-blue-600">Pricing</a>
              <a href="/resources" className="text-gray-600 hover:text-blue-600">Resources</a>
            </nav>
            <div className="flex items-center gap-4">
              <button onClick={() => router.push("/sign-in")} className="text-gray-700 hover:text-blue-600">
                Sign in
              </button>
              <Button onClick={handleGetStarted} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Modern Clean Design */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="bg-blue-50 text-blue-600 text-sm font-medium px-4 py-2 rounded-full inline-flex items-center mb-6">
            <span>See what's new from One Calendar</span>
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="text-blue-600">All your events</span> in one place,<br />beautifully organized
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            One Calendar is a smart calendar client that manages your schedule, so you don't have to.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Button onClick={handleGetStarted} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 py-6 text-lg">
              Get Started
            </Button>
            <Button variant="outline" onClick={() => router.push("/sign-in")} className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-full px-8 py-6 text-lg">
              Login
            </Button>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl max-w-5xl mx-auto">
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

      {/* Features Tab Navigation */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center mb-12 overflow-x-auto pb-2">
            <div className="inline-flex border border-gray-200 rounded-full p-1 bg-gray-50">
              <button 
                onClick={() => setActiveTab("cloud")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "cloud" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Cloud Sync
              </button>
              <button 
                onClick={() => setActiveTab("sharing")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "sharing" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Easy Sharing
              </button>
              <button 
                onClick={() => setActiveTab("analytics")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "analytics" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Analytics
              </button>
              <button 
                onClick={() => setActiveTab("weather")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "weather" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Weather
              </button>
              <button 
                onClick={() => setActiveTab("shortcuts")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "shortcuts" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Shortcuts
              </button>
              <button 
                onClick={() => setActiveTab("import")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition ${activeTab === "import" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"}`}
              >
                Import & Export
              </button>
            </div>
          </div>

          {/* Features Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              {activeTab === "cloud" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <CloudIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Cloud Sync</h2>
                  <p className="text-lg text-gray-600">
                    Access your events from anywhere with secure cloud storage. Your calendar stays in sync across all your devices, so you're always up to date.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1">
                        <span className="text-blue-600 text-xs">✓</span>
                      </div>
                      <span className="text-gray-700">Real-time synchronization</span>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1">
                        <span className="text-blue-600 text-xs">✓</span>
                      </div>
                      <span className="text-gray-700">End-to-end encryption</span>
                    </li>
                    <li className="flex items-start">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center mr-3 mt-1">
                        <span className="text-blue-600 text-xs">✓</span>
                      </div>
                      <span className="text-gray-700">Multi-device support</span>
                    </li>
                  </ul>
                </div>
              )}
              {activeTab === "sharing" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <Share2Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Easy Sharing</h2>
                  <p className="text-lg text-gray-600">
                    Collaborate and share your schedule with ease. Perfect for team coordination and family planning.
                  </p>
                </div>
              )}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <BarChart3Icon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Analytics</h2>
                  <p className="text-lg text-gray-600">
                    Gain insights with smart event tracking and summaries. Understand how you spend your time.
                  </p>
                </div>
              )}
              {activeTab === "weather" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <SunIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Weather Integration</h2>
                  <p className="text-lg text-gray-600">
                    See real-time weather in your calendar view. Plan outdoor events with confidence.
                  </p>
                </div>
              )}
              {activeTab === "shortcuts" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <KeyboardIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Keyboard Shortcuts</h2>
                  <p className="text-lg text-gray-600">
                    Navigate quickly using customizable shortcuts. Work efficiently without touching your mouse.
                  </p>
                </div>
              )}
              {activeTab === "import" && (
                <div className="space-y-6">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-xl">
                    <ImportIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-3xl font-semibold">Import & Export</h2>
                  <p className="text-lg text-gray-600">
                    Easily move data in and out of One Calendar. Compatible with all standard calendar formats.
                  </p>
                </div>
              )}
            </div>
            <div className="order-1 md:order-2">
              <div className="bg-gray-100 rounded-2xl p-4 shadow-inner h-80 flex items-center justify-center">
                <Image
                  src="/api/placeholder/600/400"
                  alt="Feature illustration"
                  width={600}
                  height={400}
                  className="rounded-xl max-h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="bg-blue-600 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to transform how you manage your time?
          </h2>
          <p className="text-blue-100 text-xl mb-10 max-w-2xl mx-auto">
            Join thousands of users who've simplified their scheduling with One Calendar.
          </p>
          <Button onClick={handleGetStarted} className="bg-white text-blue-600 hover:bg-blue-50 rounded-full px-8 py-6 text-lg font-medium">
            Get Started — It's Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <span className="text-xl font-bold text-blue-600">One Calendar</span>
              <p className="mt-4 text-gray-500 text-sm">
                All your events in one place, beautifully organized.
              </p>
            </div>
            <div>
              <h3 className="text-gray-900 font-medium mb-4">Product</h3>
              <ul className="space-y-3 text-gray-500 text-sm">
                <li><a href="/features" className="hover:text-blue-600">Features</a></li>
                <li><a href="/pricing" className="hover:text-blue-600">Pricing</a></li>
                <li><a href="/integrations" className="hover:text-blue-600">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 font-medium mb-4">Company</h3>
              <ul className="space-y-3 text-gray-500 text-sm">
                <li><a href="/about" className="hover:text-blue-600">About</a></li>
                <li><a href="/blog" className="hover:text-blue-600">Blog</a></li>
                <li><a href="/careers" className="hover:text-blue-600">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-gray-900 font-medium mb-4">Legal</h3>
              <ul className="space-y-3 text-gray-500 text-sm">
                <li><a href="/privacy" className="hover:text-blue-600">Privacy</a></li>
                <li><a href="/terms" className="hover:text-blue-600">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">&copy; 2025 One Calendar. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="https://github.com/Dev-Huang1/One-Calendar" target="_blank" rel="noopener" className="text-gray-400 hover:text-gray-600">
                <GithubIcon className="w-5 h-5" />
              </a>
              <a href="https://x.com/One__Cal" target="_blank" rel="noopener" className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 32 32">
                  <path d="M 4.0175781 4 L 13.091797 17.609375 L 4.3359375 28 L 6.9511719 28 L 14.246094 19.34375 L 20.017578 28 L 20.552734 28 L 28.015625 28 L 18.712891 14.042969 L 27.175781 4 L 24.560547 4 L 17.558594 12.310547 L 12.017578 4 L 4.0175781 4 z M 7.7558594 6 L 10.947266 6 L 24.279297 26 L 21.087891 26 L 7.7558594 6 z"></path>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
