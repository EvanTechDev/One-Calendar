'use client';

import { AuthenticateWithRedirectCallback, useClerk } from '@clerk/nextjs';
import { useEffect } from 'React';

export default function SSOSignInCallback() {
  const { setSession } = useClerk();

  useEffect(() => {
    setSession?.({ forceRedirectUrl: '/' });
  }, [setSession]);

  return <AuthenticateWithRedirectCallback />;
}
