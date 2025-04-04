"use client"

import { toast } from "@/components/ui/use-toast"

export interface Suggestion {
  id: string
  title: string
  content: string
  createdAt: number
  expiresAt: number
  priority: "low" | "medium" | "high"
  type: "tip" | "reminder" | "improvement"
  read: boolean
  dismissed: boolean
}

const SUGGESTIONS_STORAGE_KEY = "calendar-suggestions"

// 预设建议模板 - 根据用户习惯显示不同建议
export const PREDEFINED_SUGGESTIONS: Omit<Suggestion, "id" | "createdAt" | "expiresAt" | "read" | "dismissed">[] = [
  {
    title: "使用日历分类",
    content:
      '为不同类型的事件创建分类，可以让您更好地组织和筛选日程。点击侧边栏中的"我的日历"下方的"添加新日历"来创建。',
    priority: "medium",
    type: "tip",
  },
  {
    title: "设置提醒",
    content: "别忘了为重要事件设置提醒，您可以在创建事件时选择提前多长时间收到通知。",
    priority: "high",
    type: "reminder",
  },
  {
    title: "使用键盘快捷键",
    content: "按 N 快速创建新事件，按 / 搜索事件，按 1、2、3 切换视图，使用箭头键导航日期。",
    priority: "low",
    type: "tip",
  },
  {
    title: "定期备份数据",
    content: '定期备份您的日历数据是个好习惯。点击右上角的用户图标，然后选择"备份数据"。',
    priority: "medium",
    type: "reminder",
  },
  {
    title: "分享事件",
    content: "您可以轻松分享事件给他人，只需在事件预览中点击分享图标，生成链接后发送给您的朋友或同事。",
    priority: "low",
    type: "tip",
  },
  {
    title: "导入Google日历",
    content: "您可以从Google日历导出ICS文件，然后在分析页面的导入功能中导入到One Calendar。",
    priority: "medium",
    type: "improvement",
  },
  {
    title: "尝试分析功能",
    content: "点击右侧栏的图表图标，查看您的时间使用分析，了解如何更高效地安排日程。",
    priority: "high",
    type: "tip",
  },
  {
    title: "使用URL添加事件",
    content: "您可以通过URL参数快速添加事件，非常适合从邮件或消息中快速创建日程。",
    priority: "low",
    type: "tip",
  },
]

// 创建新建议
export function createSuggestion(
  suggestion: Omit<Suggestion, "id" | "createdAt" | "expiresAt" | "read" | "dismissed">,
): Suggestion {
  const now = Date.now()
  // 默认7天过期
  const expiresIn = 7 * 24 * 60 * 60 * 1000

  return {
    ...suggestion,
    id: `sug_${now}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    expiresAt: now + expiresIn,
    read: false,
    dismissed: false,
  }
}

// 获取所有建议
export function getSuggestions(): Suggestion[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(SUGGESTIONS_STORAGE_KEY)
    if (!stored) return []

    return JSON.parse(stored)
  } catch (error) {
    console.error("Error reading suggestions from localStorage:", error)
    return []
  }
}

// 保存建议
export function saveSuggestions(suggestions: Suggestion[]) {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(SUGGESTIONS_STORAGE_KEY, JSON.stringify(suggestions))
  } catch (error) {
    console.error("Error saving suggestions to localStorage:", error)
  }
}

// 添加新建议
export function addSuggestion(suggestion: Omit<Suggestion, "id" | "createdAt" | "expiresAt" | "read" | "dismissed">) {
  const suggestions = getSuggestions()
  const newSuggestion = createSuggestion(suggestion)
  saveSuggestions([...suggestions, newSuggestion])
  return newSuggestion
}

// 标记建议为已读
export function markSuggestionAsRead(id: string) {
  const suggestions = getSuggestions()
  const updated = suggestions.map((s) => (s.id === id ? { ...s, read: true } : s))
  saveSuggestions(updated)
}

// 解除建议
export function dismissSuggestion(id: string) {
  const suggestions = getSuggestions()
  const updated = suggestions.map((s) => (s.id === id ? { ...s, dismissed: true } : s))
  saveSuggestions(updated)
}

// 清理过期建议
export function cleanupExpiredSuggestions() {
  const suggestions = getSuggestions()
  const now = Date.now()
  const valid = suggestions.filter((s) => s.expiresAt > now && !s.dismissed)

  if (valid.length !== suggestions.length) {
    saveSuggestions(valid)
  }

  return valid
}

// 检查是否应该显示建议
export function shouldShowSuggestion(): Suggestion | null {
  const suggestions = cleanupExpiredSuggestions()

  // 如果没有可显示的建议，随机生成一个
  if (suggestions.length === 0) {
    const shouldGenerate = Math.random() < 0.3 // 30%的概率生成新建议

    if (shouldGenerate) {
      const randomIndex = Math.floor(Math.random() * PREDEFINED_SUGGESTIONS.length)
      const suggestion = PREDEFINED_SUGGESTIONS[randomIndex]
      return addSuggestion(suggestion)
    }

    return null
  }

  // 优先显示未读的高优先级建议
  const highPriority = suggestions.find((s) => s.priority === "high" && !s.read)
  if (highPriority) return highPriority

  // 其次显示未读的中优先级建议
  const mediumPriority = suggestions.find((s) => s.priority === "medium" && !s.read)
  if (mediumPriority) return mediumPriority

  // 再次显示未读的低优先级建议
  const lowPriority = suggestions.find((s) => s.priority === "low" && !s.read)
  if (lowPriority) return lowPriority

  // 最后随机选择一个已读但未解除的建议
  const unread = suggestions.filter((s) => !s.dismissed)
  if (unread.length > 0) {
    const randomIndex = Math.floor(Math.random() * unread.length)
    return unread[randomIndex]
  }

  return null
}

// 显示建议 Toast
export function showSuggestionToast(language = "zh") {
  const suggestion = shouldShowSuggestion()
  if (!suggestion) return

  // 标记为已读
  markSuggestionAsRead(suggestion.id)

  // 显示 Toast
  toast({
    title: suggestion.title,
    description: suggestion.content,
    duration: 10000, // 10秒
    action: (
      <Button variant="outline" size="sm" onClick={() => dismissSuggestion(suggestion.id)}>
        {language === "zh" ? "知道了" : "Got it"}
      </Button>
    ),
  })
}

// 辅助函数，仅用于导入
import { Button } from "@/components/ui/button"

  
