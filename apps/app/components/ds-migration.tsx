"use client";

import { useEffect, useState } from "react";
import { didSignedFetch } from "@/lib/ds-client";
import { t } from "@onecalendar/i18n";
import type { MigrateBundle } from "@onecalendar/types";

type Session = { signedIn: boolean; ds?: string };

export default function DsMigration() {
  const text = t("zh");
  const [session, setSession] = useState<Session>({ signedIn: false });
  const [currentDs, setCurrentDs] = useState("");
  const [newDs, setNewDs] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/atproto/session")
      .then((r) => r.json())
      .then((data) => {
        setSession(data);
        if (data.ds) {
          setCurrentDs(data.ds);
          setNewDs(data.ds);
        }
      })
      .catch(() => setSession({ signedIn: false }));
  }, []);

  const runMigration = async () => {
    setStatus("loading");
    setError("");
    try {
      const snapshot = await didSignedFetch<MigrateBundle>(currentDs, "/api/events", { method: "GET" });

      await didSignedFetch(newDs, "/api/migrate/import", {
        method: "POST",
        body: JSON.stringify(snapshot),
      });

      const updateRes = await fetch("/api/atproto/ds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ds: newDs }),
      });
      if (!updateRes.ok) throw new Error(await updateRes.text());

      try {
        await didSignedFetch(currentDs, "/api/migrate/cleanup", {
          method: "DELETE",
        });
      } catch (cleanupError) {
        await fetch("/api/atproto/ds", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ds: currentDs }),
        });
        throw cleanupError;
      }

      setCurrentDs(newDs);
      setStatus("success");
    } catch (e) {
      try {
        await didSignedFetch(newDs, "/api/migrate/cleanup", { method: "DELETE" });
      } catch {}
      setStatus("error");
      setError(e instanceof Error ? e.message : text.dsError);
    }
  };

  if (!session.signedIn) return null;

  return (
    <section style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <h2>{text.dsMigrationTitle}</h2>
      <p>{text.dsMigrationHint}</p>
      <p>{text.dsCurrent}: {currentDs}</p>
      <input
        value={newDs}
        onChange={(e) => setNewDs(e.target.value)}
        placeholder={text.dsInputPlaceholder}
        style={{ width: "100%", marginBottom: 12, padding: 8 }}
      />
      <button onClick={runMigration} disabled={status === "loading" || !newDs || newDs === currentDs}>
        {status === "loading" ? text.dsMigrating : text.dsMigrateConfirm}
      </button>
      {status === "success" ? <p style={{ color: "green" }}>{text.dsSuccess}</p> : null}
      {error ? <p style={{ color: "red" }}>{error}</p> : null}
    </section>
  );
}
