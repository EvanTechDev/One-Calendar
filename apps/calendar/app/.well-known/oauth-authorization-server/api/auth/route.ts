import { oauthProviderAuthServerMetadata } from '@zntr/auth/server'
import { auth } from '@/lib/auth'

export const GET = oauthProviderAuthServerMetadata(auth)
