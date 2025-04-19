"use client"

import { toast } from "@/components/ui/use-toast"
import { useEffect } from "react"

export default function TestToastPage() {
  useEffect(() => {
    toast({
      title: "自动弹出的 toast",
      description: "页面加载时触发",
    })
  }, [])

  return (
    <div className="p-10">
      <h1 className="text-xl mb-4">测试页面</h1>
      <button
        onClick={() =>
          toast({
            title: "点击弹出 toast",
            description: "你刚刚点击了按钮",
          })
        }
        className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        弹出 Toast
      </button>
    </div>
  )
}
