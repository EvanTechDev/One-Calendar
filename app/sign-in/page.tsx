import { Calendar } from "lucide-react"
import { LoginForm } from "@/components/LoginForm"

export default function LoginPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden from-blue-500 via-indigo-500 to-purple-500 p-6 md:p-10">
      <div className="fixed -z-10 inset-0 overflow-hidden">
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-blue-400 opacity-20 blur-[80px]" />
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-purple-400 opacity-25 blur-[100px]" />
        <div className="absolute right-1/4 bottom-1/3 h-[250px] w-[250px] rounded-full bg-indigo-400 opacity-20 blur-[90px]" />
      </div>
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
