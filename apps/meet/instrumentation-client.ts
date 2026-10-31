import { initBotId } from 'botid/client/core'
import { BOT_ID_ROUTES } from '@zntr/auth/bot-policy'

initBotId({ protect: BOT_ID_ROUTES })
