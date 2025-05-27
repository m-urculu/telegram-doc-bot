"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Bot, Chrome, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { type SupabaseClient } from "@supabase/supabase-js" // Import SupabaseClient type

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null) // Specify SupabaseClient type

  useEffect(() => {
    setSupabase(createClientComponentClient())
  }, [])

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Back Button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <Card className="bg-gray-900/80 backdrop-blur-xl border-gray-800 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-white">Welcome Back</h1>
              <p className="text-gray-300">Sign in to manage your document bots</p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={async () => {
                  if (!supabase) return
                  setIsLoading(true) // Set loading to true
                  try {
                    const { error } = await supabase.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined }
                    })
                    if (error) {
                      console.error('Google sign-in error:', error.message)
                      setIsLoading(false) // Set loading to false on error
                    }
                    // On success, redirection will occur.
                  } catch (e) {
                    console.error('Unexpected sign-in error:', e)
                    setIsLoading(false) // Set loading to false on unexpected error
                  }
                }}
                disabled={isLoading}
                className="w-full bg-white text-black hover:bg-gray-100 h-12"
                size="lg"
              >
                <Chrome className="mr-2 h-5 w-5" />
                {isLoading ? "Signing in..." : "Continue with Google"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
