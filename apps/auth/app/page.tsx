import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { RETURN_TO_PARAM } from '@zntr/auth/return-to'
import { AccountDashboard } from '@/components/account/account-dashboard'
import { getPortal } from '@/lib/auth'
import type { PortalUser } from '@/components/account/account-sections'

/**
 * The portal's root is the account dashboard.
 *
 * A visitor with no session is sent to sign-in with a return to here, so the
 * round trip lands them where they were going rather than on a bare form. This
 * is also the URL an app's "manage your account" link points at, which is why it
 * must handle the signed-out case rather than assume a session.
 */
export default async function PortalHome() {
  const session = await getPortal().auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect(`/sign-in?${RETURN_TO_PARAM}=${encodeURIComponent('/')}`)
  }

  const user = session.user as unknown as PortalUser
  return <AccountDashboard user={user} />
}
