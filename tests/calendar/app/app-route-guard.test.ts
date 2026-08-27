// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `/app` requires a session.
 *
 * It never did. The page read the session with `authClient.useSession()` and
 * rendered the calendar regardless, so a signed-out visitor kept the whole app
 * shell and every refresh kept them there. Sign-out called `router.refresh()`,
 * which re-ran a page with nothing to gate on and therefore changed nothing.
 *
 * The guard belongs on the server: a client-side redirect renders the shell first,
 * and a shell that briefly appears for a signed-out user is the same bug with
 * better timing.
 */
const getSession = vi.fn()
const redirect = vi.fn((to: string) => {
  // Next's redirect throws to unwind the render; mimicking that is what lets a
  // test tell "redirected" apart from "redirected and then carried on anyway".
  throw new Error(`NEXT_REDIRECT:${to}`)
})

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))

const { requireAppSession } = await import('@/lib/auth/require-session')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAppSession', () => {
  it('returns the session when signed in', async () => {
    const session = { user: { id: 'u1', email: 'a@example.com' } }
    getSession.mockResolvedValueOnce(session)

    await expect(requireAppSession()).resolves.toEqual(session)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects to sign-in when there is no session', async () => {
    getSession.mockResolvedValueOnce(null)

    await expect(requireAppSession()).rejects.toThrow(/NEXT_REDIRECT/)
    expect(redirect).toHaveBeenCalledWith('/sign-in')
  })

  it('redirects when a session exists with no user', async () => {
    // Better Auth can return a session shape whose user is absent; treating that
    // as signed in is how a half-valid cookie gets through.
    getSession.mockResolvedValueOnce({ user: null })

    await expect(requireAppSession()).rejects.toThrow(/NEXT_REDIRECT/)
    expect(redirect).toHaveBeenCalledWith('/sign-in')
  })

  it('fails closed without redirecting when the session store throws', async () => {
    // A database outage must not open the door. Failing closed on an auth check is
    // the opposite trade from the CAPTCHA check, and for the opposite reason:
    // there the fallback is "no bot defence", here it is "no access control".
    getSession.mockRejectedValueOnce(new Error('connection refused'))

    await expect(requireAppSession()).rejects.toThrow(
      /Session service unavailable/,
    )
    expect(redirect).not.toHaveBeenCalled()
  })

  it('carries a return path so sign-in sends the user back', async () => {
    getSession.mockResolvedValueOnce(null)

    await expect(requireAppSession('/app/settings')).rejects.toThrow(
      /NEXT_REDIRECT/,
    )
    expect(redirect).toHaveBeenCalledWith('/sign-in?redirect=%2Fapp%2Fsettings')
  })
})
