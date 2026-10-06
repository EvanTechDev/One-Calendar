import WebAccountPanel from '@/components/app/profile/web-account-panel'
import { requireAppSession } from '@/lib/auth/require-session'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  await requireAppSession('/account')
  const { section } = await searchParams
  return (
    <main className="min-h-dvh bg-background px-6 py-8 sm:px-12">
      <header className="mx-auto flex max-w-3xl items-center justify-between border-b pb-6">
        <Link
          href="/app"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to calendar
        </Link>
        <img src="/icon.svg" alt="Zentra" width={28} height={28} />
      </header>
      <div className="mx-auto max-w-3xl py-10 sm:py-14">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            Your account
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your profile, security, and connected sign-in methods.
          </p>
        </div>
        <WebAccountPanel section={section} />
      </div>
    </main>
  )
}
