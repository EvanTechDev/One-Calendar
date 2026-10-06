import { APP_CONFIG as PUBLIC_CONFIG } from '@zntr/ui/calendar/lib/config'

export const APP_CONFIG = {
  ...PUBLIC_CONFIG,
  auth: {
    enabledOAuthProviders: [] as const,
    resend: {
      sender:
        process.env.RESEND_SENDER_EMAIL ??
        'Zentra Calendar <no-reply@xyehr.cn>',
    },
  },
} as const
