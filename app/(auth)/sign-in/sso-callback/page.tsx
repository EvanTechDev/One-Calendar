'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SSOSignInCallback() {
  return <AuthenticateWithRedirectCallback />;
}
