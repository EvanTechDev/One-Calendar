import { Calendar } from "lucide-react"
import { LoginForm } from "@/components/LoginForm"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden from-blue-500 via-indigo-500 to-purple-500 p-6 md:p-10">
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium text-gray-800">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
