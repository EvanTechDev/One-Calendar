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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign in with Bluesky</CardTitle>
        <CardDescription>Enter your ATProto handle to continue with OAuth</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="alice.bsky.social"
          autoComplete="username"
        />
        <Button className="w-full" onClick={startLogin} disabled={!handle || loading}>
          {loading ? "Redirecting..." : "Continue with ATProto OAuth"}
        </Button>
        {error || queryError ? <p className="text-sm text-red-500">{error || queryError}</p> : null}
      </CardContent>
    </Card>
  );
}

export function AtprotoLoginForm() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Loading...</div>}>
      <AtprotoLoginContent />
    </Suspense>
  );
}
