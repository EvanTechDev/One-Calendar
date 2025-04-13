'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

export default function SSOSignInCallback() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect_url') || '/';
      window.location.href = redirect;
    }
  }, [isLoaded, isSignedIn]);

  return null;
}
