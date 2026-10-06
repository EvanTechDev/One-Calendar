import WebAccountPanel from '@/components/app/profile/web-account-panel'
import { requireAppSession } from '@/lib/auth/require-session'

export default async function DesktopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  await requireAppSession('/desktop/settings')
  const { section } = await searchParams
  return (
    <main className="bg-background min-h-dvh p-4">
      <WebAccountPanel section={section} embedded />
    </main>
  )
}
