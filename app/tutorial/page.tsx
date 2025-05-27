import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, MessageSquare, Settings, FileText, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function TutorialPage() {
  const steps = [
    {
      id: 1,
      title: "Create a Telegram Bot with BotFather",
      description: "Start a conversation with @BotFather on Telegram to create your bot",
      icon: <Bot className="h-6 w-6" />,
      details: [
        "Open Telegram and search for @BotFather",
        "Send /newbot command",
        "Choose a name for your bot",
        "Choose a username ending with 'bot'",
        "Copy the bot token provided",
      ],
    },
    {
      id: 2,
      title: "Register on Our Platform",
      description: "Create an account using your Google credentials",
      icon: <Settings className="h-6 w-6" />,
      details: [
        "Click 'Get Started' on our homepage",
        "Sign in with your Google account",
        "Complete your profile setup",
        "Access your dashboard",
      ],
    },
    {
      id: 3,
      title: "Add Your Bot to the Platform",
      description: "Connect your Telegram bot to our system",
      icon: <MessageSquare className="h-6 w-6" />,
      details: [
        "Go to your dashboard",
        "Click 'Create Bot'",
        "Enter your bot name and token",
        "Define your bot's personality",
        "Save the configuration",
      ],
    },
    {
      id: 4,
      title: "Upload Google Docs",
      description: "Add documents that your bot will use for responses",
      icon: <FileText className="h-6 w-6" />,
      details: [
        "Click 'Add Document' in your dashboard",
        "Enter the document title",
        "Paste the Google Docs URL",
        "Assign the document to your bot",
        "Save the assignment",
      ],
    },
    {
      id: 5,
      title: "Test Your Bot",
      description: "Start chatting with your bot on Telegram",
      icon: <CheckCircle className="h-6 w-6" />,
      details: [
        "Find your bot on Telegram",
        "Send /start command",
        "Ask questions related to your documents",
        "Monitor responses in your dashboard",
        "Refine bot personality if needed",
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Text with Doc Bot</h1>
          </div>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How to Set Up Your Document Bot</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Follow this step-by-step guide to create your first Telegram bot that can answer questions based on your
            Google Docs.
          </p>
        </div>

        {/* Tutorial Steps */}
        <div className="max-w-4xl mx-auto space-y-8">
          {steps.map((step, index) => (
            <Card key={step.id} className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">{step.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline">Step {step.id}</Badge>
                      <CardTitle className="text-xl">{step.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">{step.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="ml-16">
                  <ul className="space-y-2">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <Card className="border-0 shadow-lg bg-blue-600 text-white">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-lg mb-6 opacity-90">
                Create your account now and build your first document bot in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <Button size="lg" variant="secondary">
                    Create Account
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
