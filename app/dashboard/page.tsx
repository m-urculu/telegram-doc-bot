"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Bot,
  FileText,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Users,
  MessageSquare,
  Search,
  Filter,
  MoreVertical
} from "lucide-react"
import { ChevronDown } from "lucide-react" // Import ChevronDown
import { useState, useEffect } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from "next/image" // Import next/image
import Link from "next/link" // Import Link for navigation
import { useRouter } from 'next/navigation'; // Import useRouter
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"
import { Check } from "lucide-react"

interface TelegramBot {
  id: string
  name: string
  api_key: string
  status: "active" | "inactive"
  documents_count: number
  messages_count: number
  created_at: string
  personality_prompt?: string
  ai_persona?: Record<string, unknown> // More specific than any
  greeting_message?: string
  fallback_response?: string
}

interface Document {
  id: string // Assuming the API returns an 'id'
  file_name: string // Matches the API response field
  file_url: string // Matches the API response field
  bot_id: string | null // Matches the API response field (can be null if not assigned)
  uploadedAt: string
  lastModified: string
}

interface EditableBotData {
  id: string
  name: string // For display context in edit form
  personality_prompt: string
  ai_persona_string: string // Store AI persona as string for textarea
  greeting_message: string
  fallback_response: string
}

interface ChatSummary {
  chat_id: number;
  telegram_user_id?: number; // from the RPC
  telegram_username?: string; // from the RPC
  last_message_text?: string;
  last_message_at?: string;
}

interface MessageDetail {
  id: string;
  text: string;
  date: string; // Assuming it's a date string
  is_bot_response: boolean;
  sender_name: string;
}

function maskApiKey(api_key: string) {
  if (!api_key) return ""
  // Show first 4 and last 4 chars, mask the rest
  if (api_key.length <= 8) return api_key
  return api_key.slice(0, 4) + "••••••••" + api_key.slice(-4)
}

function formatSimpleDate(dateString: string | undefined): string {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch { // Error variable not needed
    return "Invalid Date";
  }
}

export default function DashboardPage() {
  const user = useUser()
  const supabaseClient = useSupabaseClient()
  const router = useRouter(); // Initialize useRouter
  const [bots, setBots] = useState<TelegramBot[]>([])
  const [documents, setDocuments] = useState<Document[]>([]) // Initialize with empty array

  const [showCreateBot, setShowCreateBot] = useState(false)
  const [showAddDocument, setShowAddDocument] = useState(false)

  // State for the create bot form
  const [newBotName, setNewBotName] = useState("")
  const [newBotToken, setNewBotToken] = useState("")
  const [newBotPersonality, setNewBotPersonality] = useState("")
  const [isCreatingBot, setIsCreatingBot] = useState(false)

  // Add state for copied feedback
  const [copiedBotId, setCopiedBotId] = useState<string | null>(null)
  const [expandedBotId, setExpandedBotId] = useState<string | null>(null)
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null)
  const [editingBotData, setEditingBotData] = useState<EditableBotData | null>(null)
  const [isUpdatingBot, setIsUpdatingBot] = useState(false)

  // State for the add document form
  // const [newDocTitle, setNewDocTitle] = useState("") // Removed
  const [newDocUrl, setNewDocUrl] = useState("")
  const [newDocBotId, setNewDocBotId] = useState<string | undefined>(undefined)
  const [isAddingDocument, setIsAddingDocument] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [updatingAssignmentDocId, setUpdatingAssignmentDocId] = useState<string | null>(null);

  // State for Messages Tab
  const [selectedBotIdForMessages, setSelectedBotIdForMessages] = useState<string | null>(null);
  const [chatsForSelectedBot, setChatsForSelectedBot] = useState<ChatSummary[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [conversationMessages, setConversationMessages] = useState<MessageDetail[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const toggleBotExpansion = (botId: string) => {
    setExpandedBotId((prevId) => {
      if (prevId === botId) {
        // Collapsing
        setEditingBotData(null)
        return null
      } else {
        // Expanding
        const botToEdit = bots.find((b) => b.id === botId)
        if (botToEdit) {
          setEditingBotData({
            id: botToEdit.id,
            name: botToEdit.name,
            personality_prompt: botToEdit.personality_prompt || "",
            ai_persona_string: botToEdit.ai_persona ? JSON.stringify(botToEdit.ai_persona, null, 2) : "",
            greeting_message: botToEdit.greeting_message || "",
            fallback_response: botToEdit.fallback_response || "",
          })
        }
        return botId
      }
    })
  }
  const [isLoadingBots, setIsLoadingBots] = useState(true); // Add loading state for bots
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: fetchedUser } } = await supabaseClient.auth.getUser();
      if (!fetchedUser) {
        router.push('/login'); // Redirect to /login if no user
        return;
      }

      // Fetch bots from API route
      const fetchBots = async () => {
        setIsLoadingBots(true); // Set loading state to true
        try {
          const res = await fetch("/api/bot");
          if (!res.ok) {
            throw new Error("Failed to fetch bots");
          }
          const { data } = await res.json();
          setBots(
            (data || []).map((bot: TelegramBot) => ({
              id: bot.id,
              name: bot.name,
              api_key: bot.api_key || "", // Correct field name
              status: bot.status || "active",
              documentsCount: bot.documents_count || 0,
              messagesCount: bot.messages_count || 0,
              createdAt: bot.created_at,
              personality_prompt: bot.personality_prompt || "",
              ai_persona: bot.ai_persona || null,
              greeting_message: bot.greeting_message || "",
              fallback_response: bot.fallback_response || "",
            }))
          );
        } catch (error) {
          console.error("Error fetching bots:", error);
          setBots([]);
        } finally {
          setIsLoadingBots(false); // Set loading state to false
        }
      };
      fetchBots();

      // Fetch documents from API route
      const fetchDocuments = async () => {
        try {
          const res = await fetch("/api/document");
          if (!res.ok) {
            throw new Error("Failed to fetch documents");
          }
          const { data } = await res.json();
          setDocuments(
            (data || []).map((doc: Document) => ({
              id: doc.id,
              file_name: doc.file_name,
              file_url: doc.file_url,
              bot_id: doc.bot_id,
              uploadedAt: doc.uploadedAt,
              lastModified: doc.uploadedAt,
            }))
          );
        } catch (error) {
          console.error("Error fetching documents:", error);
          setDocuments([]);
        }
      };
      fetchDocuments();
    };

    checkUser();
  }, [router, supabaseClient]); // Add router and supabaseClient as dependencies

  // Effect for fetching chats when a bot is selected in Messages Tab
  useEffect(() => {
    if (!selectedBotIdForMessages) {
      setChatsForSelectedBot([]);
      setSelectedChat(null);
      setConversationMessages([]);
      return;
    }

    const fetchChats = async () => {
      setIsLoadingChats(true);
      setSelectedChat(null);
      setConversationMessages([]);
      try {
        const res = await fetch(`/api/bot/${selectedBotIdForMessages}/chats`);
        if (!res.ok) throw new Error("Failed to fetch chats");
        const { data } = await res.json();
        setChatsForSelectedBot(data || []);
      } catch (error) {
        console.error("Error fetching chats:", error);
        setChatsForSelectedBot([]);
        alert(`Error fetching chats: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsLoadingChats(false);
      }
    };
    fetchChats();
  }, [selectedBotIdForMessages]);

  // Effect for fetching conversation when a chat is selected
  useEffect(() => {
    if (!selectedChat || !selectedBotIdForMessages) {
      setConversationMessages([]);
      return;
    }
    const fetchConversation = async () => {
      setIsLoadingConversation(true);
      try {
        const res = await fetch(`/api/bot/${selectedBotIdForMessages}/chats/${selectedChat.chat_id}`);
        if (!res.ok) throw new Error("Failed to fetch conversation");
        const { data } = await res.json();
        setConversationMessages(data || []);
      } catch (error) {
        console.error("Error fetching conversation:", error);
        setConversationMessages([]);
        alert(`Error fetching conversation: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        setIsLoadingConversation(false);
      }
    };
    fetchConversation();
  }, [selectedChat, selectedBotIdForMessages]);

  const handleCreateBot = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreatingBot(true)

    try {
      const response = await fetch("/api/bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newBotName,
          apiKey: newBotToken,
          personalityPrompt: newBotPersonality,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to create bot: ${response.statusText}`)
      }

      const { data: createdBot } = await response.json()

      setBots((prevBots) => [
        ...prevBots,
        {
          id: createdBot.id,
          name: createdBot.name,
          api_key: createdBot.api_key || "", // Correct field name
          status: "active", // Assuming new bots are active
          documents_count: 0, // Correct field name
          messages_count: 0, // Correct field name
          created_at: createdBot.created_at, // Correct field name
          personality_prompt: createdBot.personality_prompt,
          ai_persona: createdBot.ai_persona,
          greeting_message: createdBot.greeting_message,
          fallback_response: createdBot.fallback_response,
        },
      ]);
      setShowCreateBot(false)
      setNewBotName("")
      setNewBotToken("")
      setNewBotPersonality("")
    } catch (error) {
      console.error("Error creating bot:", error)
      alert(`Error creating bot: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsCreatingBot(false)
    }
  }

  const handleDeleteBot = async (botId: string) => {
    if (!window.confirm("Are you sure you want to delete this bot? This action cannot be undone.")) {
      return
    }
    setDeletingBotId(botId)
    try {
      const response = await fetch("/api/bot", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: botId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete bot: ${response.statusText}`)
      }

      // const result = await response.json(); // Contains { message: 'Bot deleted successfully.' }
      // console.log(result.message);

      setBots((prevBots) => prevBots.filter((bot) => bot.id !== botId))
      if (expandedBotId === botId) {
        setExpandedBotId(null) // Collapse if it was expanded
      }
    } catch (error) {
      console.error("Error deleting bot:", error)
      alert(`Error deleting bot: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setDeletingBotId(null)
    }
  }

  const handleEditInputChange = (field: keyof Omit<EditableBotData, "id" | "name">, value: string) => {
    if (editingBotData) {
      setEditingBotData({
        ...editingBotData,
        [field]: value,
      })
    }
  }

  const handleUpdateBot = async () => {
    if (!editingBotData) return;
    setIsUpdatingBot(true);
    try {
      let aiPersona = null;
      if (editingBotData.ai_persona_string.trim() !== "") {
        try {
          aiPersona = JSON.parse(editingBotData.ai_persona_string);
        } catch {
          throw new SyntaxError("Invalid JSON format for AI Persona.");
        }
      }

      const updatedFields: Record<string, unknown> = {
        id: editingBotData.id,
        personalityPrompt: editingBotData.personality_prompt,
        aiPersona: aiPersona,
        greetingMessage: editingBotData.greeting_message,
        fallbackResponse: editingBotData.fallback_response,
      };

      // Regenerate bot personality if personality_prompt is changed
      const originalBot = bots.find((b) => b.id === editingBotData.id);
      if (originalBot && originalBot.personality_prompt !== editingBotData.personality_prompt) {
        const geminiPrompt = `Generate a JSON object containing the following for a sales bot based on this personality prompt: "${editingBotData.personality_prompt}". The JSON object should have the keys "persona" (a detailed JSON object representing the bot's personality traits, tone, style, and specific instructions), "greeting" (a short and engaging greeting message), and "fallback" (a polite and helpful fallback response when the bot doesn't understand).`;
        const geminiResponse = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: geminiPrompt }),
        });

        if (!geminiResponse.ok) {
          throw new Error("Failed to regenerate bot personality.");
        }

        const { persona, greeting, fallback } = await geminiResponse.json();
        updatedFields.aiPersona = persona;
        updatedFields.greetingMessage = greeting;
        updatedFields.fallbackResponse = fallback;
      }

      const response = await fetch(`/api/bot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update bot: ${response.statusText}`);
      }

      const { data: updatedBotApi } = await response.json();

      setBots((prevBots) =>
        prevBots.map((b) =>
          b.id === editingBotData.id
            ? {
                ...b,
                name: updatedBotApi.name || b.name,
                personality_prompt: updatedBotApi.personality_prompt,
                ai_persona: updatedBotApi.ai_persona,
                greeting_message: updatedBotApi.greeting_message,
                fallback_response: updatedBotApi.fallback_response,
              }
            : b
        )
      );

      // Reload the bot edit component
      toggleBotExpansion(editingBotData.id);
    } catch (error) {
      console.error("Error updating bot:", error);
      alert(`Error updating bot: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsUpdatingBot(false);
    }
  }

  const handleAddDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsAddingDocument(true)

    if (!newDocUrl) {
      alert("Document URL is required.")
      setIsAddingDocument(false)
      return
    }

    try {
      const response = await fetch("/api/document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // file_name: newDocTitle || "Untitled Document", // Removed, backend will handle title
          file_url: newDocUrl,
          bot_id: newDocBotId === "none" ? null : newDocBotId || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to add document: ${response.statusText}`)
      }

      const { data: createdDoc } = await response.json()

      setDocuments((prevDocs) => [
        {
          id: createdDoc.id,
          file_name: createdDoc.file_name,
          file_url: createdDoc.file_url,
          bot_id: createdDoc.bot_id,
          uploadedAt: createdDoc.uploaded_at,
          lastModified: createdDoc.uploaded_at, // Or a more specific field if available
        },
        ...prevDocs, // Add to the beginning of the list for immediate visibility
      ])
      setShowAddDocument(false)
      // setNewDocTitle("") // Removed
      setNewDocUrl("")
      setNewDocBotId(undefined)
    } catch (error) {
      console.error("Error adding document:", error)
      alert(`Error adding document: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsAddingDocument(false)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return
    }
    setDeletingDocId(docId)
    try {
      const response = await fetch("/api/document", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: docId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete document: ${response.statusText}`)
      }

      setDocuments((prevDocs) => prevDocs.filter((doc) => doc.id !== docId))
      // Optionally, show a success message
      // alert("Document deleted successfully!");

    } catch (error) {
      console.error("Error deleting document:", error)
      alert(`Error deleting document: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setDeletingDocId(null)
    }
  }

  const handleAssignBotToDocument = async (docId: string, newBotId: string | null) => {
    setUpdatingAssignmentDocId(docId);
    try {
        const response = await fetch("/api/document", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: docId, botId: newBotId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update document assignment");
        }

        const { data: updatedDoc } = await response.json();

        setDocuments((prevDocs) =>
            prevDocs.map((doc) =>
                doc.id === updatedDoc.id ? { ...doc, bot_id: updatedDoc.bot_id, lastModified: updatedDoc.updated_at || updatedDoc.uploaded_at } : doc
            )
        );
    } catch (error) {
        console.error("Error assigning bot to document:", error);
        alert(`Error assigning bot: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
        setUpdatingAssignmentDocId(null);
    }
  };


  return (
    <div className="min-h-screen bg-black text-gray-100">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-black to-blue-900/10" />

      <header className="relative z-50 border-b border-gray-800 backdrop-blur-xl bg-black/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white group-hover:text-purple-300 transition-colors">Dashboard</h1>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 p-1 rounded-md hover:bg-gray-800/70 transition-colors">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-white">
                    {user?.user_metadata?.full_name || user?.email || "User"}
                  </p>
                  <p className="text-xs text-gray-300">
                    {user?.email || ""}
                  </p>
                </div>
                {user?.user_metadata?.avatar_url ? (
                  <Image
                    src={user.user_metadata.avatar_url}
                    alt={user.user_metadata.full_name || "User"}
                    width={40} // Provide width
                    height={40} // Provide height
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.src = "/fallback-avatar.png"; // Fallback image
                      e.currentTarget.alt = "Fallback User"; // Update alt text
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white">
                    <Users className="h-5 w-5" /> {/* Fallback icon */}
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 w-48">
              <DropdownMenuItem
                className="text-red-400 hover:text-white hover:bg-red-600/80 cursor-pointer"
                onSelect={async () => {
                  await supabaseClient.auth.signOut()
                  router.push("/") // Redirect to homepage after sign out
                }}
              >
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Main Content */}
        <Tabs defaultValue="bots" className="space-y-6">
          <TabsList className="bg-gray-900/50 border-gray-800">
            <TabsTrigger value="bots" className="data-[state=active]:bg-gray-800 text-gray-100">
              <Bot className="h-4 w-4 mr-2" />
              Bots
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-gray-800 text-gray-100">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-gray-800 text-gray-100">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bots" className="space-y-6">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800">
              <div className="px-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Telegram Bots</h2>
                    <p className="text-sm text-gray-100">Manage your bots and their configurations</p>
                  </div>
                  <Button
                    onClick={() => setShowCreateBot(!showCreateBot)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bot
                  </Button>
                </div>

                {/* Search and Filter */}
                {bots.length > 0 && (
                  <div className="flex gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search bots..."
                        className="pl-10 bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="border-gray-700 text-gray-800 bg-white hover:bg-gray-100"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                )}


                {showCreateBot && (
                  <Card className="bg-gray-800/50 border-gray-700 mb-6">
                    <div className="px-4">
                      <h3 className="text-lg font-semibold mb-4 text-white">Create New Bot</h3>
                      <form className="space-y-4" onSubmit={handleCreateBot}>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="botName" className="text-gray-300">
                              Bot Name
                            </Label>
                            <Input
                              id="botName"
                              placeholder="Enter bot name"
                              className="bg-gray-900 border-gray-700 text-white placeholder-gray-400"
                              value={newBotName}
                              onChange={(e) => setNewBotName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="botToken" className="text-gray-300">
                              Bot Token
                            </Label>
                            <Input
                              id="botToken"
                              placeholder="Enter bot token from BotFather"
                              className="bg-gray-900 border-gray-700 text-white placeholder-gray-400"
                              value={newBotToken}
                              onChange={(e) => setNewBotToken(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="botPersonality" className="text-gray-300">
                            Bot Personality
                          </Label>
                          <Input
                            id="botPersonality"
                            placeholder="Describe bot personality and behavior"
                            className="bg-gray-900 border-gray-700 text-white placeholder-gray-400"
                            value={newBotPersonality}
                            onChange={(e) => setNewBotPersonality(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button
                            type="submit"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            disabled={isCreatingBot}
                          >
                            {isCreatingBot ? "Creating..." : "Create Bot"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowCreateBot(false)}
                            className="border-gray-700 text-gray-900 hover:bg-gray-800 hover:text-gray-200"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  </Card>
                )}

                {isLoadingBots ? (
                  <div className="text-center py-10">
                    <Bot className="mx-auto h-12 w-12 text-gray-500 animate-spin" />
                    <h3 className="mt-2 text-sm font-medium text-gray-300">Loading bots...</h3>
                  </div>
                ) : bots.length === 0 && !showCreateBot ? (
                  <div className="text-center py-10">
                    <Bot className="mx-auto h-12 w-12 text-gray-500" />
                    <h3 className="mt-2 text-sm font-medium text-gray-300">No bots found</h3>
                    <p className="mt-1 text-sm text-gray-400">Get started by creating a new bot.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bots.map((bot) => (
                      <div
                        key={bot.id}                        
                        className="bg-gray-800/50 border border-gray-700 rounded-lg px-6 py-3 hover:bg-gray-800/70 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                              <Bot className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-white mt-2">{bot.name}</h3>
                              {/* Only show the partially hidden API key and copy button below */}
                              {bot.api_key ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 font-mono">
                                    {maskApiKey(bot.api_key)}
                                  </span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="text-gray-400 hover:text-purple-400 p-1"
                                    title="Copy API Key"
                                    onClick={async () => {
                                      await navigator.clipboard.writeText(bot.api_key)
                                      setCopiedBotId(bot.id)
                                      setTimeout(() => setCopiedBotId(null), 1200)
                                    }}
                                  >
                                    {copiedBotId === bot.id ? (
                                      <Check className="h-4 w-4 text-green-400" />
                                    ) : (
                                      <FileText className="h-4 w-4" />
                                    )}
                                  </Button>
                                  {copiedBotId === bot.id && (
                                    <span className="text-xs text-green-400 ml-1">Copied!</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">API Key not available</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-300">{bot.messages_count} messages</p>
                              <p className="text-sm text-gray-300">{bot.documents_count} documents</p>
                            </div>
                            <Badge
                              variant={bot.status === "active" ? "default" : "secondary"}
                              className={
                                bot.status === "active" ? "bg-green-500/20 text-green-300 border-green-400/50" : ""
                              }
                            >
                              {bot.status}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-400">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                                <DropdownMenuItem
                                  className="text-gray-200 hover:text-white hover:bg-purple-600/80"
                                  onClick={() => toggleBotExpansion(bot.id)}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-400 hover:text-white hover:bg-red-600/80"
                                  onClick={() => handleDeleteBot(bot.id)}
                                  disabled={deletingBotId === bot.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {deletingBotId === bot.id ? "Deleting..." : "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        {expandedBotId === bot.id &&
                          editingBotData && (
                            <div className="mt-6 p-6 bg-gray-800/70 border border-gray-700 rounded-lg space-y-4">
                              <h4 className="text-lg font-semibold text-white mb-3">Edit Bot: {editingBotData.name}</h4>

                              <div className="space-y-1">
                                <Label htmlFor={`personality-${bot.id}`} className="text-gray-300 flex items-center gap-2">
                                  Personality Prompt
                                  <span className="text-xs text-yellow-400">(Changing this will regenerate the bot personality)</span>
                                </Label>
                                <Textarea
                                  id={`personality-${bot.id}`}
                                  value={editingBotData.personality_prompt}
                                  onChange={(e) => handleEditInputChange("personality_prompt", e.target.value)}
                                  placeholder="Define the bot's personality..."
                                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 min-h-[80px]"
                                  rows={3}
                                />
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor={`aiPersona-${bot.id}`} className="text-gray-300">
                                  AI Persona (JSON)
                                </Label>
                                <Textarea
                                  id={`aiPersona-${bot.id}`}
                                  value={editingBotData.ai_persona_string}
                                  onChange={(e) => handleEditInputChange("ai_persona_string", e.target.value)}
                                  placeholder='e.g., {"style": "formal", "role": "assistant"}'
                                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 min-h-[100px] font-mono text-xs"
                                  rows={5}
                                />
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor={`greeting-${bot.id}`} className="text-gray-300">
                                  Greeting Message
                                </Label>
                                <Textarea
                                  id={`greeting-${bot.id}`}
                                  value={editingBotData.greeting_message}
                                  onChange={(e) => handleEditInputChange("greeting_message", e.target.value)}
                                  placeholder="Hello! How can I help you today?"
                                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 min-h-[60px]"
                                  rows={2}
                                />
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor={`fallback-${bot.id}`} className="text-gray-300">
                                  Fallback Response
                                </Label>
                                <Textarea
                                  id={`fallback-${bot.id}`}
                                  value={editingBotData.fallback_response}
                                  onChange={(e) => handleEditInputChange("fallback_response", e.target.value)}
                                  placeholder="I'm not sure how to respond to that. Can you try asking differently?"
                                  className="bg-gray-900 border-gray-600 text-white placeholder-gray-400 min-h-[60px]"
                                  rows={2}
                                />
                              </div>

                              <div className="flex gap-3 pt-2">
                                <Button
                                  onClick={handleUpdateBot}
                                  disabled={isUpdatingBot}
                                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                                >
                                  {isUpdatingBot ? "Saving..." : "Save Changes"}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => toggleBotExpansion(bot.id)}
                                  className="border-gray-700 text-gray-900 hover:bg-gray-800 hover:text-gray-200"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800">
              <div className="px-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Documents</h2>
                    <p className="text-sm text-gray-100">Upload and assign Google Docs to your bots</p>
                  </div>
                  <Button
                    onClick={() => setShowAddDocument(!showAddDocument)}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </div>

                {showAddDocument && (
                  <Card className="bg-gray-800/50 border-gray-700 mb-6">
                    <div className="px-4">
                      <h3 className="text-lg font-semibold mb-4 text-white">Add New Document</h3>
                      <form className="space-y-4" onSubmit={handleAddDocument}>
                        <div className="space-y-2">
                          <Label htmlFor="docUrl" className="text-gray-300">
                            Google Docs URL
                          </Label>
                          <Input
                            id="docUrl"
                            placeholder="https://docs.google.com/document/d/..."
                            className="bg-gray-900 border-gray-700 text-white placeholder-gray-400"
                            value={newDocUrl}
                            onChange={(e) => setNewDocUrl(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="assignBot" className="text-gray-300">
                            Assign to Bot
                          </Label>
                          <Select value={newDocBotId} onValueChange={setNewDocBotId}>
                            <SelectTrigger className="bg-gray-900 border-gray-700 text-white">
                              <SelectValue placeholder="Select a bot" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-700">
                              <SelectItem value="none" className="text-gray-400 hover:bg-gray-800">Do not assign</SelectItem>
                              {bots.map((bot) => (
                                <SelectItem key={bot.id} value={bot.id} className="text-gray-300 hover:bg-gray-800">
                                  {bot.name} ({maskApiKey(bot.api_key)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3 pt-3">
                          <Button
                            type="submit"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                            disabled={isAddingDocument}
                          >
                            {isAddingDocument ? "Adding..." : "Add Document"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddDocument(false)}
                            className="border-gray-700 text-gray-900 hover:bg-gray-800 hover:text-gray-200"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  </Card>
                )}

                {documents.length === 0 && !showAddDocument ? (
                  <div className="text-center py-10">
                    <FileText className="mx-auto h-12 w-12 text-gray-500" />
                    <h3 className="mt-2 text-sm font-medium text-gray-300">No documents found</h3>
                    <p className="mt-1 text-sm text-gray-400">Get started by adding a new document.</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {documents.map((doc) => (
                      <Card
                        key={doc.id}
                        className="bg-gray-800/50 border-gray-700 hover:bg-gray-800/70 transition-colors"
                      >
                        <div className="px-6 py-3">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="h-5 w-5 text-green-400" />
                              </div>                            <div>
                                {/* Use file_name from fetched data */}
                                <h3 className="font-semibold text-white">{doc.file_name}</h3>
                                <p className="text-sm text-gray-100 mt-1">Last modified: {formatSimpleDate(doc.lastModified)}</p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-400">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                                <DropdownMenuItem className="text-gray-200 hover:text-white hover:bg-purple-600/80">
                                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center w-full cursor-pointer">
                                    <ExternalLink className="h-4 w-4 mr-4" />
                                    Open
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-400 hover:text-white hover:bg-red-600/80"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  disabled={deletingDocId === doc.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {deletingDocId === doc.id ? "Deleting..." : "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300">Assigned to:</span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs px-2 py-1 h-auto border-gray-600 text-gray-800 hover:bg-gray-700 hover:text-white disabled:opacity-70"
                                  disabled={!!updatingAssignmentDocId} // Disable if any assignment is in progress
                                >
                                  {updatingAssignmentDocId === doc.id ? "Updating..." : (
                                    doc.bot_id ? (bots.find(b => b.id === doc.bot_id)?.name || "Unknown Bot") : "Not Assigned"
                                  )}
                                  {updatingAssignmentDocId !== doc.id && <ChevronDown className="h-3 w-3 ml-1 opacity-50" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="bg-gray-900 border-gray-800 w-56">
                                <DropdownMenuItem
                                  onSelect={() => handleAssignBotToDocument(doc.id, null)}
                                  className="cursor-pointer text-gray-400 hover:bg-gray-800"
                                >
                                  Unassign
                                </DropdownMenuItem>
                                {bots.map((bot) => (
                                  <DropdownMenuItem
                                    key={bot.id}
                                    onSelect={() => handleAssignBotToDocument(doc.id, bot.id)}
                                    className="cursor-pointer text-gray-300 hover:bg-gray-800"
                                  >
                                    {bot.name}
                                  </DropdownMenuItem>
                                ))}
                                {bots.length === 0 && (
                                  <DropdownMenuItem disabled className="text-gray-500">No bots available to assign</DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <Card className="bg-gray-900/50 backdrop-blur-xl border-gray-800">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">Messages</h2>
                    <p className="text-sm text-gray-100">View and manage messages from your bots</p>
                  </div>
                  {/* Add any relevant buttons here, e.g., <Button>Export Messages</Button> */}
                </div>
                
                {/* Bot Selector for Messages */}
                <div className="mb-6">
                  <Label htmlFor="botSelectorMessages" className="text-gray-300 mb-2 block">Select a Bot</Label>
                  <Select
                    value={selectedBotIdForMessages || ""}
                    onValueChange={(value) => {
                      setSelectedBotIdForMessages(value === "none" ? null : value);
                      setSelectedChat(null); // Reset selected chat when bot changes
                    }}
                  >
                    <SelectTrigger id="botSelectorMessages" className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Choose a bot to view messages" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      <SelectItem value="none" className="text-gray-400 hover:bg-gray-800">-- Select a Bot --</SelectItem>
                      {bots.map((bot) => (
                        <SelectItem key={bot.id} value={bot.id} className="text-gray-300 hover:bg-gray-800">
                          {bot.name}
                        </SelectItem>
                      ))}
                      {bots.length === 0 && <SelectItem value="no-bots" disabled>No bots available</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBotIdForMessages && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Chats List Column */}
                    <div className="md:col-span-1 bg-gray-800/50 p-4 rounded-lg border border-gray-700 max-h-[600px] overflow-y-auto">
                      <h3 className="text-lg font-semibold text-white mb-3">Chats</h3>
                      {isLoadingChats ? (
                        <p className="text-gray-400">Loading chats...</p>
                      ) : chatsForSelectedBot.length > 0 ? (
                        <ul className="space-y-2">
                          {chatsForSelectedBot.map((chat) => (
                            <li key={chat.chat_id}>
                              <Button
                                variant="ghost"
                                className={`w-full justify-start text-left h-auto py-2 px-3 ${selectedChat?.chat_id === chat.chat_id ? 'bg-purple-600/30 text-purple-200' : 'text-gray-300 hover:bg-gray-700/50'}`}
                                onClick={() => setSelectedChat(chat)}
                              >
                                <div className="truncate">
                                  <p className="font-medium">{chat.telegram_username || `User ${chat.telegram_user_id}`}</p>
                                  <p className="text-xs text-gray-400 truncate">{chat.last_message_text}</p>
                                  <p className="text-xs text-gray-500 mt-1">{formatSimpleDate(chat.last_message_at)}</p>
                                </div>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400">No chats found for this bot.</p>
                      )}
                    </div>

                    {/* Conversation View Column */}
                    <div className="md:col-span-2 bg-gray-800/50 p-4 rounded-lg border border-gray-700 max-h-[600px] overflow-y-auto flex flex-col">
                      <h3 className="text-lg font-semibold text-white mb-3 sticky top-0 bg-gray-800/50 py-2 z-10">
                        {selectedChat ? `Conversation with ${selectedChat.telegram_username || `User ${selectedChat.telegram_user_id}`}` : "Select a chat to view messages"}
                      </h3>
                      {isLoadingConversation ? (
                        <p className="text-gray-400">Loading conversation...</p>
                      ) : selectedChat && conversationMessages.length > 0 ? (
                        <div className="space-y-3 flex-grow overflow-y-auto pr-2">
                          {conversationMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.is_bot_response ? 'justify-start' : 'justify-end'}`}>
                              <div className={`max-w-[70%] p-3 rounded-lg ${msg.is_bot_response ? 'bg-gray-700 text-gray-200' : 'bg-purple-600 text-white'}`}>
                                <p className="text-sm">{msg.text}</p>
                                <p className={`text-xs mt-1 ${msg.is_bot_response ? 'text-gray-400' : 'text-purple-200'} text-right`}>{formatSimpleDate(msg.date)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedChat ? (
                        <p className="text-gray-400">No messages in this chat, or an error occurred.</p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
