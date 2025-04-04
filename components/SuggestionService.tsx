"use client"

import { useState, useEffect } from "react"
import { toast } from "@/components/ui/use-toast"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { LightbulbIcon } from "lucide-react"

// 建议类型定义
export interface Suggestion {
  id: string
  content: string
  durationDays: number
  createdAt: string
  dismissed: boolean
}

// 默认建议
const DEFAULT_SUGGESTIONS: Suggestion[] = [
  {
    id: "1",
    content: "尝试使用日历分类功能来更好地组织您的事件",
    durationDays: 3,
    createdAt: new Date().toISOString(),
    dismissed: false,
  },
  {
    id: "2",
    content: "您知道可以通过点击时间格子快速创建事件吗？",
    durationDays: 5,
    createdAt: new Date().toISOString(),
    dismissed: false,
  },
  {
    id: "3",
    content: "使用书签功能来保存重要事件，方便快速访问",
    durationDays: 7,
    createdAt: new Date().toISOString(),
    dismissed: false,
  },
  {
    id: "4",
    content: "定期备份您的日历数据是个好习惯",
    durationDays: 10,
    createdAt: new Date().toISOString(),
    dismissed: false,
  },
]

export function SuggestionService() {
  const [language] = useLanguage()
  const t = translations[language]
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [initialized, setInitialized] = useState(false)

  // 初始化建议
  useEffect(() => {
    if (!initialized) {
      // 从localStorage加载建议
      const storedSuggestions = localStorage.getItem("suggestions")
      if (storedSuggestions) {
        setSuggestions(JSON.parse(storedSuggestions))
      } else {
        // 如果没有存储的建议，使用默认建议
        const translatedSuggestions = DEFAULT_SUGGESTIONS.map((suggestion) => ({
          ...suggestion,
          content: language === "zh" ? suggestion.content : translateSuggestion(suggestion.content),
        }))
        setSuggestions(translatedSuggestions)
        localStorage.setItem("suggestions", JSON.stringify(translatedSuggestions))
      }
      setInitialized(true)
    }
  }, [initialized, language])

  // 显示建议
  useEffect(() => {
    if (suggestions.length > 0 && initialized) {
      const now = new Date()

      // 过滤出未被忽略且在有效期内的建议
      const validSuggestions = suggestions.filter((suggestion) => {
        if (suggestion.dismissed) return false

        const createdDate = new Date(suggestion.createdAt)
        const expiryDate = new Date(createdDate)
        expiryDate.setDate(expiryDate.getDate() + suggestion.durationDays)

        return now <= expiryDate
      })

      if (validSuggestions.length > 0) {
        // 随机选择一个建议显示
        const randomIndex = Math.floor(Math.random() * validSuggestions.length)
        const suggestionToShow = validSuggestions[randomIndex]

        // 使用toast显示建议
        setTimeout(() => {
          toast({
            title: language === "zh" ? "小贴士" : "Tip",
            description: suggestionToShow.content,
            action: (
              <Button variant="outline" size="sm" onClick={() => dismissSuggestion(suggestionToShow.id)}>
                {language === "zh" ? "不再显示" : "Don't show again"}
              </Button>
            ),
            icon: <LightbulbIcon className="h-5 w-5 text-yellow-500" />,
            duration: 10000, // 10秒
          })
        }, 2000) // 延迟2秒显示
      }
    }
  }, [suggestions, initialized, language])

  // 忽略建议
  const dismissSuggestion = (id: string) => {
    const updatedSuggestions = suggestions.map((suggestion) =>
      suggestion.id === id ? { ...suggestion, dismissed: true } : suggestion,
    )
    setSuggestions(updatedSuggestions)
    localStorage.setItem("suggestions", JSON.stringify(updatedSuggestions))
  }

  // 添加新建议
  const addSuggestion = (content: string, durationDays: number) => {
    const newSuggestion: Suggestion = {
      id: Date.now().toString(),
      content,
      durationDays,
      createdAt: new Date().toISOString(),
      dismissed: false,
    }

    const updatedSuggestions = [...suggestions, newSuggestion]
    setSuggestions(updatedSuggestions)
    localStorage.setItem("suggestions", JSON.stringify(updatedSuggestions))

    return newSuggestion.id
  }

  // 翻译建议内容（简单实现）
  const translateSuggestion = (zhContent: string): string => {
    const translations: Record<string, string> = {
      尝试使用日历分类功能来更好地组织您的事件: "Try using calendar categories to better organize your events",
      "您知道可以通过点击时间格子快速创建事件吗？":
        "Did you know you can quickly create events by clicking on time slots?",
      "使用书签功能来保存重要事件，方便快速访问": "Use the bookmark feature to save important events for quick access",
      定期备份您的日历数据是个好习惯: "Regularly backing up your calendar data is a good habit",
    }

    return translations[zhContent] || zhContent
  }

  // 组件不渲染任何内容，只是提供功能
  return null
}

// 导出一个自定义hook，用于在其他组件中添加建议
export function useSuggestions() {
  const addSuggestion = (content: string, durationDays: number) => {
    const storedSuggestions = localStorage.getItem("suggestions")
    let suggestions: Suggestion[] = storedSuggestions ? JSON.parse(storedSuggestions) : []

    const newSuggestion: Suggestion = {
      id: Date.now().toString(),
      content,
      durationDays,
      createdAt: new Date().toISOString(),
      dismissed: false,
    }

    suggestions = [...suggestions, newSuggestion]
    localStorage.setItem("suggestions", JSON.stringify(suggestions))

    return newSuggestion.id
  }

  return { addSuggestion }
}

