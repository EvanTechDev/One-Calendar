'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

export default function SSOSignUpCallback() {
  return <AuthenticateWithRedirectCallback />
}
