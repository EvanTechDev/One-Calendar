"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { rotateRecoveryKey } from "@/lib/e2ee/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function KeyRotationPanel() {
  const { user } = useUser();
  const [oldRecoveryKey, setOldRecoveryKey] = useState("");
  const [newRecoveryKey, setNewRecoveryKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRotate = async () => {
    if (!user) return;
    try {
      setError("");
      setMessage("");
      const result = await rotateRecoveryKey(user.id, oldRecoveryKey);
      setNewRecoveryKey(result.newRecoveryKey);
      setMessage(`Recovery key rotated successfully. Key version ${result.oldKeyVersion} -> ${result.newKeyVersion}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rotation failed");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recovery key rotation</CardTitle>
        <CardDescription>
          Verify your old recovery key, then generate a new one while keeping the same encrypted data key.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder="Current recovery key"
          value={oldRecoveryKey}
          onChange={(event) => setOldRecoveryKey(event.target.value)}
        />
        <Button onClick={handleRotate}>Rotate recovery key</Button>
        {newRecoveryKey && <p className="rounded bg-muted p-3 text-sm break-all">New recovery key: {newRecoveryKey}</p>}
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </CardContent>
    </Card>
  );
}
