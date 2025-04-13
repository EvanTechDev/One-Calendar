import { Calendar } from "lucide-react"
import { LoginForm } from "@/components/LoginForm"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-6 md:p-10">
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium text-gray-800">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>
        <LoginForm />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-40 h-96 w-96 rounded-full bg-blue-500 opacity-30 blur-[100px]" />
        <div className="absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-purple-500 opacity-30 blur-[100px]" />
        <div className="absolute right-1/4 top-1/3 h-64 w-64 rounded-full bg-indigo-500 opacity-20 blur-[80px]" />
      </div>
      </div>
    </div>
  )
}
