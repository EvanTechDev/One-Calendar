"use client"
import AuthWaitingLoading from "@/components/app/auth-waiting-loading"
import dynamic from "next/dynamic"

const Calendar = dynamic(() => import("@/components/app/calendar"), {
  loading: () => <AuthWaitingLoading />,
})

export default function Home() {
  return <Calendar />
}
