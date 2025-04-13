import { Calendar } from "lucide-react"

import { ResetPasswordForm } from "@/components/ResetForm";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 from-blue-500 via-indigo-500 to-purple-500 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
            <Calendar className="size-4" color="#0066ff" />
          One Calendar
        </a>
        <ResetPasswordForm />
      </div>
    </div>
  )
}
