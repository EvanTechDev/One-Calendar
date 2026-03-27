"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signedDsFetch } from "@/lib/ds-client";
import { dsI18n } from "@onecalendar/i18n";

type Step = "idle" | "export" | "import" | "cleanup" | "update" | "done" | "error";

export default function DsMigrationCard({ language }: { language: string }) {
  const i18n = useMemo(() => dsI18n[language as keyof typeof dsI18n] || dsI18n.en, [language]);
  const [currentDs, setCurrentDs] = useState("");
  const [nextDs, setNextDs] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");

  async function loadCurrent() {
    const res = await fetch("/api/ds-pointer", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setCurrentDs(data.ds || "");
  }

  async function handleMigrate() {
    setError("");
    if (!currentDs || !nextDs) {
      setError("missing_ds_url");
      return;
    }
    try {
      setStep("export");
      const exportRes = await signedDsFetch(currentDs, "/api/migrate/export", { method: "GET" });
      if (!exportRes.ok) throw new Error(await exportRes.text());
      const encryptedDump = await exportRes.json();

      setStep("import");
      const importRes = await signedDsFetch(nextDs, "/api/migrate/import", {
        method: "POST",
        body: JSON.stringify(encryptedDump)
      });
      if (!importRes.ok) throw new Error(await importRes.text());

      setStep("cleanup");
      const cleanupRes = await signedDsFetch(currentDs, "/api/migrate/cleanup", { method: "DELETE" });
      if (!cleanupRes.ok) throw new Error(await cleanupRes.text());

      setStep("update");
      const pointerRes = await fetch("/api/ds-pointer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ds: nextDs })
      });
      if (!pointerRes.ok) throw new Error(await pointerRes.text());
      setCurrentDs(nextDs);
      setStep("done");
    } catch (e) {
      setStep("error");
      setError(e instanceof Error ? e.message : "migration_failed");
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <div className="font-semibold">{i18n.migrateTitle}</div>
        <p className="text-sm text-muted-foreground">{i18n.migrateDescription}</p>
      </div>
      <Button variant="outline" onClick={loadCurrent}>Load current DS</Button>
      <div className="text-sm">Current DS: {currentDs || "-"}</div>
      <Input value={nextDs} onChange={(e) => setNextDs(e.target.value)} placeholder={i18n.migrateTargetLabel} />
      <Button onClick={handleMigrate}>{i18n.migrateStart}</Button>
      <div className="text-sm">
        {step === "idle" && i18n.migrateProgressIdle}
        {step === "export" && i18n.migrateProgressExport}
        {step === "import" && i18n.migrateProgressImport}
        {step === "cleanup" && i18n.migrateProgressCleanup}
        {step === "update" && i18n.migrateProgressUpdate}
        {step === "done" && i18n.migrateSuccess}
        {step === "error" && `${i18n.migrateFailed}: ${error}`}
      </div>
    </div>
  );
}
