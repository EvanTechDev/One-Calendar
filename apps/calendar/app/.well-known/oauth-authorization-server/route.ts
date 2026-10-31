import { oauthProviderAuthServerMetadata } from '@zntr/auth/server'
import { auth } from '@/features/auth'

export const GET = oauthProviderAuthServerMetadata(auth)
