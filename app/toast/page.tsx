"use client"

import { useToast } from "@/components/ui/use-toast"

export default function ToastTestPage() {
  const { toast } = useToast()

  return (
    <div>
      <button onClick={() => toast({ title: "测试", description: "是否正常" })}>
        弹 toast
      </button>
    </div>
  )
}
