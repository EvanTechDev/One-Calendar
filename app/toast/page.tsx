"use client"
import { toast } from "@/components/ui/use-toast"

export default function TestToast() {
  return (
    <button
      onClick={() => {
        toast({
          title: "测试通知",
          description: "这是一个测试 toast。",
        })
      }}
      className="p-3 bg-green-500 text-white rounded"
    >
      弹出测试 Toast
    </button>
  )
}
