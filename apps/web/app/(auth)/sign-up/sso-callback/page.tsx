'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SSOSignUpCallback() {
  useEffect(() => {
    fetch('/api/atproto/logout', { method: 'POST' }).catch(() => undefined);
  }, []);

  return <AuthenticateWithRedirectCallback />;
}
