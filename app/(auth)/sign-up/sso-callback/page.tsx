'use client';

import { AuthenticateWithRedirectCallback, useClerk } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SSOSignUpCallback() {
  const { setSession } = useClerk();

  useEffect(() => {
    fetch("/api/atproto/logout", { method: "POST" }).catch(() => undefined);
    setSession?.({ forceRedirectUrl: '/app' });
  }, [setSession]);

  return <AuthenticateWithRedirectCallback />;
}
