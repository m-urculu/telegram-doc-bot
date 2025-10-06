"use client"
import { useEffect } from "react"
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card" 
import { Bot, Sparkles, Globe, MessageSquare, FileText, ArrowRight, User as UserIcon } from "lucide-react"
// import { Zap, Shield, Code as UserIcon } from "lucide-react"
import Link from "next/link"
import Image from "next/image" // Import next/image

export default function HomePage() {
  return <HomePageContent />
}

function HomePageContent() {
  const supabase = useSupabaseClient()
  const user = useUser()

  useEffect(() => {
    // Debug: check if the Supabase client is initialized and user is present
    console.log("Supabase client:", supabase)
    console.log("Supabase user:", user)
    supabase?.auth.getSession().then((session) => {
      console.log("Supabase session:", session)
    })
  }, [supabase, user])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/20 via-black to-blue-900/20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/10 via-transparent to-transparent" />

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 backdrop-blur-xl bg-black/50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold">DocBot AI</span>
            </div>

            {/* Navigation replaced with project pages */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="/tutorial" className="text-gray-300 hover:text-white transition-colors">
                Tutorial
              </Link>
              <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
                Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-3">
                  {user.user_metadata?.avatar_url ? (
                    <Image
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata.full_name || user.email || "User"}
                      width={32} // Provide width
                      height={32} // Provide height
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <UserIcon className="w-8 h-8" />
                  )}
                  <div className="text-right">
                    <div className="text-sm font-medium">{user.user_metadata?.full_name || user.email}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-white"
                    title="Sign out"
                    onClick={async () => {
                      await supabase.auth.signOut()
                    }}
                  >
                    Sign out
                  </Button>
                </div>
              ) : (
                <Link href="/login">
                  <Button
                    variant={undefined}
                    className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white"
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2">
              <Sparkles className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-blue-300">AI-Powered Document Bots</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold">
              <span className="gradient-white">Create Your</span>
              <br />
              <span className="gradient-blue">Business AI Bot</span>
              <br />
              <span className="gradient-white">Effortlessly</span>
            </h1>

            <p className="text-xl text-secondary-light max-w-lg">
              Transform your documents into intelligent Telegram bots. Upload, configure, and deploy in minutes with our
              powerful AI platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/tutorial">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-lg px-8"
                >
                  Start Building <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Chat Preview */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-600/20 blur-3xl" />
            <Card className="relative bg-gray-900/80 backdrop-blur-xl border-gray-800 p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-6 select-text">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-600 rounded-full flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Support Bot</h3>
                  <p className="text-sm text-gray-400">Online</p>
                </div>
              </div>

              <div className="space-y-4 select-text">
                <div className="flex gap-3 justify-end">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-600 rounded-2xl rounded-tr-none p-4 max-w-[80%]">
                    <p className="text-sm text-white">
                      How can I integrate the API?
                    </p>
                  </div>
                  <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-600 rounded-full flex-shrink-0">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full flex-shrink-0">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div className="bg-gray-800 rounded-2xl rounded-tl-none p-4 max-w-[80%]">
                    <p className="text-sm text-white">Based on our documentation, you can integrate our API by following these steps...</p>
                  </div>
                </div>

              </div>

              <div className="mt-6 flex items-center gap-2 p-3 bg-gray-800 rounded-xl select-text">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400 !cursor-default"
                  style={{ cursor: "default" }}
                  readOnly
                  tabIndex={-1}
                />
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-blue-600 !cursor-default"
                  tabIndex={-1}
                  style={{ cursor: "default" }}
                  disabled
                >
                  Send
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-white">
            <span className="bg-gradient-to-r from-blue-400 to-blue-400 bg-clip-text text-transparent">
              Key Features
            </span>{" "}
            in a Glance
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Everything you need to build, deploy, and manage intelligent document-based bots
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <MessageSquare className="h-6 w-6" />,
              title: "Smart Conversations",
              description: "AI-powered responses based on your document content",
            },
            {
              icon: <FileText className="h-6 w-6" />,
              title: "Document Integration",
              description: "Seamlessly connect Google Docs and other sources",
            },
            // {
            //   icon: <Zap className="h-6 w-6" />,
            //   title: "Instant Deployment",
            //   description: "Deploy to Telegram in seconds with one click",
            // },
            // {
            //   icon: <Shield className="h-6 w-6" />,
            //   title: "Enterprise Security",
            //   description: "Bank-level encryption and data protection",
            // },
            {
              icon: <Globe className="h-6 w-6" />,
              title: "Multi-Language",
              description: "Support for 50+ languages out of the box",
            },
            // {
            //   icon: <Code className="h-6 w-6" />,
            //   title: "Developer API",
            //   description: "Powerful APIs for custom integrations",
            // },
            {
              icon: <Bot className="h-6 w-6" />,
              title: "Bot Analytics",
              description: "Track performance and user interactions",
            },
            // {
            //   icon: <Sparkles className="h-6 w-6" />,
            //   title: "AI Training",
            //   description: "Continuously improve bot responses",
            // },
          ].map((feature, index) => (
            <Card
              key={index}
              className="bg-gray-900/50 backdrop-blur-xl border-gray-800 p-6 hover:bg-gray-900/70 transition-all hover:scale-105 hover:border-blue-600/50"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <div className="text-blue-600">{feature.icon}</div>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-white">{feature.title}</h3>
              <p className="text-sm text-gray-300">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      {/* <section className="relative z-10 container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-blue-900/50 to-blue-900/50 backdrop-blur-xl border-blue-500/20 p-12 text-center">
          <h2 className="text-4xl font-bold mb-4 text-white">Start Building Your AI Bot Today</h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses automating their customer support with intelligent document bots
          </p>
          <Link href="/register">
            <Button size="lg" className="bg-white text-black hover:bg-gray-100 text-lg px-8">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </Card>
      </section> */}

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800 bg-black/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold">DocBot AI</span>
              </div>
              <p className="text-gray-400">Transform your documents into intelligent bots.</p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Product</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <Link href="/features" className="hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="hover:text-white transition-colors">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="/changelog" className="hover:text-white transition-colors">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Resources</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <Link href="/docs" className="hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/api" className="hover:text-white transition-colors">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2 text-gray-300">
                <li>
                  <Link href="/about" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 DocBot AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
