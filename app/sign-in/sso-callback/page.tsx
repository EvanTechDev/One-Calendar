'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';

export default function SSOSignInCallback() {
  const { isLoaded, isSignedIn } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      const redirect = searchParams.get('redirect_url') || '/';
      window.location.href = redirect;
    }
  }, [isLoaded, isSignedIn, searchParams]);

  return null;
}
