import { checkFixedWindowLimit, rateLimitedResponse } from '@/lib/rate-limit'

/** Initial sends and resends consume the same per-organiser budget. */
export async function limitInviteSend(
  userId: string,
): Promise<Response | null> {
  const limit = await checkFixedWindowLimit({
    name: 'invite-send',
    subject: userId,
    limit: 50,
    windowSeconds: 3600,
  })
  return limit.allowed ? null : rateLimitedResponse(limit.retryAfter)
}
