import { Calendar } from "lucide-react"
import { LoginForm } from "@/components/LoginForm"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-purple-50 to-white p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl bg-white/70 p-8 shadow-lg backdrop-blur-sm">
        <a href="/" className="flex items-center gap-2 self-center font-medium text-gray-800">
          <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>
        <LoginForm />
      </div>
    </div>
  )
}
