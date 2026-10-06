import { checkBotId } from 'botid/server'
import { BOT_ID_OPTIONS, botIdIsGuarded } from './bot-policy'

/** An outage or missing deployment configuration cannot disable the API gate. */
export async function rejectBotRequest(
  method: string,
  path: string,
): Promise<Response | null> {
  if (!botIdIsGuarded(method, path)) return null
  try {
    const result = await checkBotId({ advancedOptions: BOT_ID_OPTIONS })
    if (result.isBot) {
      return Response.json(
        {
          error: 'BOT_DETECTED',
          message:
            'Unable to verify this request. Please reload and try again.',
        },
        { status: 403 },
      )
    }
    return null
  } catch {
    console.error('[auth] BotID verification unavailable', { path })
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
