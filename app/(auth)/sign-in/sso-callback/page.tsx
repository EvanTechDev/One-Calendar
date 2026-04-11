'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SSOSignInCallback() {
  return <AuthenticateWithRedirectCallback />;
}
