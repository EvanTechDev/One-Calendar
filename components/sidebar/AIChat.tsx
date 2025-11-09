"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { SendHorizonal, CopyIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface AIChatSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
  systemPrompt?: string
}

export default function AIChatSheet({ 
  open, 
  onOpenChange, 
  trigger,
  systemPrompt = "You are a helpful AI assistant."
}: AIChatSheetProps) {
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isSignedIn) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ]
        })
      })

      if (!response.ok) throw new Error('Failed to fetch response')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const aiMessageId = Date.now().toString()
      let aiMessageContent = ""

      setMessages(prev => [...prev, { id: aiMessageId, content: "", role: 'assistant', timestamp: new Date() }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const textChunk = new TextDecoder().decode(value)
        aiMessageContent += textChunk
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, content: aiMessageContent } : msg))
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), content: `Error: ${error.message || 'Request failed'}`, role: 'assistant', timestamp: new Date() }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>One AI</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full w-full pr-4">
            <div className="flex flex-col gap-4 py-4">
              {!isSignedIn ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                  <p>Please sign in to use One AI</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <img src="/ai.svg" alt="One AI" className="w-24 h-24 mb-4" />
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === 'user'
                  const [copied, setCopied] = useState(false)
                  const messageRef = useRef<HTMLDivElement>(null)

                  const handleCopy = () => {
                    navigator.clipboard.writeText(message.content)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }

                  const isAILoading = isLoading && !isUser

                  return (
                    <div key={message.id} className={cn("group flex w-full px-4 py-1", isUser ? "justify-end" : "justify-start")}>
                      <div
                        ref={messageRef}
                        className={cn(
                          "relative max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                          isUser ? "bg-[#0066ff] text-white rounded-br-md" : "bg-gray-100 text-gray-900 rounded-bl-md"
                        )}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm break-words dark:prose-invert max-w-none">
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
                            copied && "opacity-100"
                          )}
                          aria-label="Copy message"
                        >
                          {copied ? <span className="text-xs">Copied!</span> : <CopyIcon className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {isSignedIn ? (
          <form onSubmit={handleSubmit} className="flex gap-2 pt-4">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <Button className="mt-4" onClick={() => router.push('/sign-in')}>
            Sign In to Chat
          </Button>
        )}
      </SheetContent>
    </Sheet>
  )
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}
