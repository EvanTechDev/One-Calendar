"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { initializeE2EEAccount, unlockAfterLogin, unlockWithRecoveryKey } from "@/lib/e2ee/client";
import { UnlockRequiredError } from "@/lib/e2ee/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnlockGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [status, setStatus] = useState<"loading" | "need-recovery" | "setup-recovery" | "ready" | "error">("loading");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState("");
  const [setupConfirmed, setSetupConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    unlockAfterLogin(user.id)
      .then(() => setStatus("ready"))
      .catch((err) => {
        if (err instanceof Error && "code" in err && err.code === "E2EE_NOT_INITIALIZED") {
          initializeE2EEAccount(user.id)
            .then((result) => {
              setGeneratedRecoveryKey(result.recoveryKey);
              setStatus("setup-recovery");
            })
            .catch((initErr) => {
              setError(initErr instanceof Error ? initErr.message : "Failed to initialize E2EE");
              setStatus("error");
            });
          return;
        }
        if (err instanceof UnlockRequiredError) {
          setStatus("need-recovery");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to unlock data key");
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, user]);

  const handleRecoveryUnlock = async () => {
    if (!user) return;
    try {
      setError("");
      await unlockWithRecoveryKey(user.id, recoveryKey);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery key validation failed");
    }
  };

  if (status === "ready") return <>{children}</>;

  if (status === "loading") {
    return <div className="p-8 text-center text-sm text-muted-foreground">Unlocking end-to-end encrypted workspace...</div>;
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {status === "need-recovery"
              ? "Enter recovery key"
              : status === "setup-recovery"
                ? "Save your recovery key"
                : "Unable to unlock workspace"}
          </CardTitle>
          <CardDescription>
            {status === "need-recovery"
              ? "This device is not trusted yet. Enter your recovery key to decrypt your data key and trust this device."
              : status === "setup-recovery"
                ? "Your account now has E2EE enabled. Save this recovery key before entering the app."
              : "Automatic device unlock failed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "need-recovery" && (
            <>
              <Input
                value={recoveryKey}
                onChange={(event) => setRecoveryKey(event.target.value)}
                placeholder="Paste your recovery key"
              />
              <Button className="w-full" onClick={handleRecoveryUnlock}>Unlock and trust this device</Button>
            </>
          )}
          {status === "setup-recovery" && (
            <>
              <p className="break-all rounded bg-muted p-3 font-mono text-xs">{generatedRecoveryKey}</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={setupConfirmed} onChange={(e) => setSetupConfirmed(e.target.checked)} />
                I saved this recovery key securely.
              </label>
              <Button className="w-full" disabled={!setupConfirmed} onClick={() => setStatus("ready")}>Continue</Button>
            </>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
