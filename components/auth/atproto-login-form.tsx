"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function AtprotoLoginContent() {
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();

  const startLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/atproto/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });

      const data = (await res.json()) as { authorizeUrl?: string; error?: string };
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error || "Failed to start OAuth login");
      }

      window.location.href = data.authorizeUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const queryError = searchParams.get("reason") || searchParams.get("error") || "";

  const appBaseUrl = (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "https://calendar.xyehr.cn").replace(/\/$/, "");
  const roseAccountOAuthUrl = `https://rose.madebydanny.uk/oauth/authorize?${new URLSearchParams({
    client_id: `${appBaseUrl}/oauth-client-metadata.json`,
  }).toString()}`;


  return (
    <div className="space-y-4">
      <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign in with Atmosphere</CardTitle>
        <CardDescription>Enter your Atmosphere handle to continue with OAuth</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="alice.bsky.social"
          autoComplete="username"
        />
        <Button className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white" onClick={startLogin} disabled={!handle || loading}>
          {loading ? "Redirecting..." : "Continue with Atmosphere OAuth"}
        </Button>
        {error || queryError ? <p className="text-sm text-red-500">{error || queryError}</p> : null}
        <Button
          variant="outline"
          className="w-full"
          type="button"
          onClick={() => (window.location.href = roseAccountOAuthUrl)}
        >
          Create an Atmosphere account
        </Button>
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Not an Atmosphere user? Return to normal <a href="/sign-in" className="underline underline-offset-4 hover:text-primary">sign in</a>
        </p>
      </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By continuing, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
      </div>
    </div>
  );
}

export function AtprotoLoginForm() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Loading...</div>}>
      <AtprotoLoginContent />
    </Suspense>
  );
}
