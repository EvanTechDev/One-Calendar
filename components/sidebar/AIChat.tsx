"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUp, Copy } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Image from "next/image"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
  systemPrompt?: string
}

// Markdown components for rendering
const markdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  code: ({ inline, children }: any) =>
    inline ? (
      <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">{children}</code>
    ) : (
      <code className="block bg-gray-100 dark:bg-gray-800 p-2 rounded my-2 text-xs overflow-x-auto">{children}</code>
    ),
}

function MessageBubble({ message, isLoading }: { message: Message; isLoading: boolean }) {
  const isUser = message.role === "user"
  const isAILoading = isLoading && !isUser
  const [copied, setCopied] = useState(false)
  const messageRef = useRef<HTMLDivElement>(null)

  const handleCopy = async () => {
    if (messageRef.current) {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={cn("group flex w-full px-4 py-1", isUser ? "justify-end" : "justify-start")}>
      <div
        ref={messageRef}
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
          isUser ? "bg-[#0066ff] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md",
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          className="prose prose-sm break-words dark:prose-invert max-w-none"
          components={markdownComponents}
        >
          {message.content}
        </ReactMarkdown>
        {isAILoading && (
          <span className="ml-2 inline-flex items-center">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
            <span className="mx-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 delay-150" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400 delay-300" />
          </span>
        )}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute -bottom-2 right-2 p-1 rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-opacity duration-200",
            isUser ? "bg-[#0056e6] text-white hover:bg-[#0047b3]" : "bg-gray-50 text-gray-500 hover:bg-gray-100",
            "opacity-0 group-hover:opacity-100",
            copied && "opacity-100",
          )}
          aria-label="Copy message"
        >
          {copied ? <span className="text-xs">Copied!</span> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

export default function AIChatSheet({
  open,
  onOpenChange,
  trigger,
  systemPrompt = "You are a helpful AI assistant.",
}: AIChatSheetProps) {
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isSignedIn) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: input },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to fetch response")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No reader available")
      }

      const aiMessageId = Date.now().toString()
      let aiMessageContent = ""

      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
        },
      ])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const textChunk = new TextDecoder().decode(value)
        aiMessageContent += textChunk

        setMessages((prev) => prev.map((msg) => (msg.id === aiMessageId ? { ...msg, content: aiMessageContent } : msg)))
      }
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          content: `Error: ${error.message || "Request failed"}`,
          role: "assistant",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>One AI</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col items-center">
          <ScrollArea ref={scrollAreaRef} className="h-full w-full">
            <div className="flex flex-col gap-2 py-4">
              {!isSignedIn ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 min-h-[400px]">
                  <p>Please sign in to use the AI assistant</p>
                  <Button onClick={() => router.push("/sign-in")}>Sign In to Chat</Button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] pt-12">
                  <Image src="/ai.svg" alt="One AI" width={120} height={120} className="mb-8" />
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLoading={isLoading && message.id === messages[messages.length - 1].id}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {isSignedIn && (
          <div className="w-full flex justify-center pb-4">
            <div className="w-full max-w-2xl">
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything"
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 pr-14 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
                <Button
                  type="submit"
                  className={cn(
                    "absolute bottom-3 right-2 h-8 w-8 rounded-lg transition-all duration-200",
                    input.trim().length === 0
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-[#0066ff] hover:bg-[#0056e6] text-white shadow-sm hover:shadow-md",
                  )}
                  disabled={input.trim().length === 0 || isLoading}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
