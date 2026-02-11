"use client"

import { CalendarIcon } from "lucide-react"

export default function AuthWaitingLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-6 dark:bg-[#0b1220]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-[#0066ff]/10 p-3 dark:bg-[#5f9dff]/20">
            <CalendarIcon className="h-6 w-6 text-[#0066ff] dark:text-[#80b3ff]" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">One Calendar</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">正在恢复你的会话</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full w-1/3 animate-[pulse_1.3s_ease-in-out_infinite] rounded-full bg-[#0066ff] dark:bg-[#80b3ff]" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            正在检查登录状态，请稍候…
          </p>
        </div>
      </div>
    </div>
  )
}
