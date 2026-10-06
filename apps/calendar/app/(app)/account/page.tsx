import WebAccountPanel from '@/components/app/profile/web-account-panel'
import { requireAppSession } from '@/lib/auth/require-session'
import Link from 'next/link'

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  await requireAppSession('/account')
  const { section } = await searchParams
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/app" className="text-sm text-muted-foreground">
        ← Calendar
      </Link>
      <h1 className="text-2xl font-semibold">Account</h1>
      <WebAccountPanel section={section} />
    </main>
  )
}
