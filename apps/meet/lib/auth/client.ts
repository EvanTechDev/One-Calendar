'use client'

import { createAuthClient } from '@zntr/auth/client'

const baseURL = process.env.NEXT_PUBLIC_BASE_URL

export const authClient = createAuthClient(baseURL ? { baseURL } : {})
