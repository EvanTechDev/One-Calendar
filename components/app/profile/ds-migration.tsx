"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signedDsFetch } from "@/lib/ds/client";

type AtprotoSession = {
  signedIn: boolean;
  did?: string;
};

type ProgressState = "idle" | "loading" | "success" | "error";

export default function DsMigration() {
  const [session, setSession] = useState<AtprotoSession | null>(null);
  const [currentDs, setCurrentDs] = useState("");
  const [nextDs, setNextDs] = useState("");
  const [status, setStatus] = useState<ProgressState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/atproto/session")
      .then(async (res) => (res.ok ? ((await res.json()) as AtprotoSession) : { signedIn: false }))
      .then(setSession)
      .catch(() => setSession({ signedIn: false }));

    fetch("/api/atproto/ds")
      .then(async (res) => (res.ok ? ((await res.json()) as { ds?: string }) : {}))
      .then((data) => {
        const resolved = data.ds || window.location.origin;
        setCurrentDs(resolved);
        setNextDs(resolved);
      })
      .catch(() => {
        setCurrentDs(window.location.origin);
        setNextDs(window.location.origin);
      });
  }, []);

  const disabled = useMemo(() => !nextDs || nextDs === currentDs || status === "loading", [nextDs, currentDs, status]);

  const runMigration = async () => {
    setStatus("loading");
    setMessage("Migrating encrypted payloads...");

    try {
      const exported = await signedDsFetch<{ shares: unknown[]; calendarData: unknown | null }>(currentDs, "/api/ds/export", {
        method: "GET",
      });

      await signedDsFetch<{ success: boolean }>(nextDs, "/api/migrate/import", {
        method: "POST",
        body: JSON.stringify(exported),
      });

      await signedDsFetch<{ success: boolean }>(currentDs, "/api/migrate/cleanup", {
        method: "DELETE",
      });

      const updateRes = await fetch("/api/atproto/ds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ds: nextDs }),
      });

      if (!updateRes.ok) {
        throw new Error(await updateRes.text());
      }

      setCurrentDs(nextDs);
      setStatus("success");
      setMessage("DS migration succeeded. New data source is active.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Migration failed");
    }
  };

  if (!session?.signedIn) {
    return null;
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-base font-semibold">迁移数据服务器（DS）</h3>
      <p className="text-sm text-muted-foreground">仅支持 Bluesky 登录用户。迁移将通过签名 API 拉取并导入密文数据，完成后清理旧 DS 并更新 app.onecalendar.ds。</p>
      <div className="text-xs text-muted-foreground">当前 DS: {currentDs || "-"}</div>
      <Input
        value={nextDs}
        onChange={(event) => setNextDs(event.target.value.trim())}
        placeholder="https://your-new-ds.example"
      />
      <Button onClick={runMigration} disabled={disabled}>
        {status === "loading" ? "迁移中..." : "确认迁移"}
      </Button>
      {message ? <div className={`text-sm ${status === "error" ? "text-red-500" : "text-muted-foreground"}`}>{message}</div> : null}
    </div>
  );
}
