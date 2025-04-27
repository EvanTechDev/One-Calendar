"use client"

import { useState, useRef, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { SendHorizonal, MessageCircle } from "lucide-react"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/i18n"
import { cn } from "@/lib/utils"

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
  const [language] = useLanguage()
  const t = translations[language]
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
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!input.trim() || isLoading) return;

  const userMessage: Message = {
    id: Date.now().toString(),
    content: input,
    role: 'user',
    timestamp: new Date()
  };

  setMessages(prev => [...prev, userMessage]);
  setInput("");
  setIsLoading(true);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: input }
        ]
      }),
    });

    if (!response.ok) throw new Error('API请求失败');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const aiMessageId = Date.now().toString();
    let aiMessageContent = "";

    setMessages(prev => [...prev, {
      id: aiMessageId,
      content: "",
      role: 'assistant',
      timestamp: new Date()
    }]);

    const removeThinkTags = (text: string) => {
      return text
        .replace(/<think>[\s\S]*?<\/think>/g, '');
        .replace(/<reasoning>.*?<\/reasoning>/gs, '')
        .replace(/<[^>]*>?/g, '');
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      let textChunk = new TextDecoder().decode(value);
      textChunk = removeThinkTags(textChunk);
      
      if (textChunk.trim()) {
        aiMessageContent += textChunk;
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: aiMessageContent } 
            : msg
        ));
      }
    }

  } catch (error: any) {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      content: `错误: ${error.message}`,
      role: 'assistant',
      timestamp: new Date()
    }]);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{t?.aiAssistant || 'AI Assistant'}</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea 
            ref={scrollAreaRef}
            className="h-full w-full pr-4"
          >
            <div className="flex flex-col gap-4 py-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {t?.aiWelcomeMessage || 'How can I help you today?'}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      )}
                    >
                      {message.content}
                      <div className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-lg bg-secondary text-secondary-foreground px-4 py-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-75" />
                      <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce delay-150" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-4">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t?.aiInputPlaceholder || 'Type your message...'}
            className="flex-1"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isLoading}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
