import { useToast } from "@/components/ui/use-toast"

export default function ToastTestPage() {
  const context = useToast()
  console.log("useToast context", context) // 👈 打印一下

  return (
    <div>
      <button onClick={() => context.toast({ title: "测试", description: "是否正常" })}>
        弹 toast
      </button>
    </div>
  )
}
