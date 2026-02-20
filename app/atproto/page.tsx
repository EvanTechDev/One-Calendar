"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AtprotoLoginPage() {
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

  return (
    <div className="mx-auto max-w-lg py-16 px-4 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in with Bluesky ATProto</h1>
      <p className="text-sm text-muted-foreground">输入你的 handle（例如 alice.bsky.social），系统会自动查询你的 PDS 并跳转到 OAuth 登录。</p>
      <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alice.bsky.social" />
      <Button onClick={startLogin} disabled={!handle || loading}>{loading ? "Redirecting..." : "Continue with ATProto OAuth"}</Button>
      {(error || searchParams.get("reason") || searchParams.get("error")) ? <p className="text-sm text-red-500">{error || searchParams.get("reason") || searchParams.get("error")}</p> : null}
    </div>
  );
}
