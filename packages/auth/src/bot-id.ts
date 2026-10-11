import { captcha } from 'better-auth/plugins'
import { checkBotId } from 'botid/server'
import { BOT_ID_ENDPOINTS, BOT_ID_OPTIONS } from './bot-policy'

const verifyBotId = () => checkBotId({ advancedOptions: BOT_ID_OPTIONS })

/**
 * Better Auth's captcha plugin with the Vercel BotID provider, guarding the
 * shared browser credential and mail-sending endpoints. Only an explicit
 * `isBot: false` verdict passes; a bot gets 403 and an unavailable check fails
 * closed with the plugin's error response.
 */
export function botIdPlugin() {
  return captcha({
    provider: 'vercel-botid',
    endpoints: BOT_ID_ENDPOINTS,
    checkBotId: verifyBotId,
  })
}

/**
 * BotID for app-owned API routes outside Better Auth. Returns a response to
 * send instead of handling the request, or null when the caller is human.
 */
export async function rejectBotRequest(): Promise<Response | null> {
  try {
    const result = await verifyBotId()
    if (result.isBot === true) {
      return Response.json(
        {
          error: 'BOT_DETECTED',
          message:
            'Unable to verify this request. Please reload and try again.',
        },
        { status: 403 },
      )
    }
    // The SDK can resolve an upstream JSON error without a classification.
    if (result.isBot !== false) throw new Error('Missing BotID verdict')
    return null
  } catch {
    console.error('[bot-id] BotID verification unavailable')
    return Response.json(
      {
        error: 'BOT_VERIFICATION_UNAVAILABLE',
        message:
          'Verification is temporarily unavailable. Please try again shortly.',
      },
      { status: 503 },
    )
  }
}
