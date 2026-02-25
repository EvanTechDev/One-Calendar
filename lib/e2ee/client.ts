import { E2EEError, UnlockRequiredError } from "@/lib/e2ee/errors";
import { loadTrustedDevice, saveTrustedDevice } from "@/lib/e2ee/indexeddb";
import type {
  E2EEInitializationResult,
  RotationResult,
  ServerKeyRecord,
  UnlockResult,
  WrappedDataKeyPayload,
} from "@/lib/e2ee/types";
import {
  generateDataKey,
  generateDeviceKey,
  generateRecoveryKey,
  importMasterKeyFromRecovery,
  unwrapDataKey,
  unwrapMasterKeyFromDevice,
  wrapDataKey,
  wrapMasterKeyForDevice,
} from "@/lib/e2ee/webcrypto";

let activeDataKey: CryptoKey | null = null;
let activeVersion = 0;

export function getActiveDataKey(): CryptoKey | null {
  return activeDataKey;
}

async function fetchServerKeyRecord(): Promise<ServerKeyRecord> {
  const res = await fetch("/api/e2ee/keys", { method: "GET" });
  if (!res.ok) {
    if (res.status === 404) throw new E2EEError("E2EE key is not initialized", "E2EE_NOT_INITIALIZED");
    throw new E2EEError("Unable to load server wrapped key", "SERVER_KEY_LOAD_FAILED");
  }
  return (await res.json()) as ServerKeyRecord;
}

async function saveServerWrappedDataKey(payload: WrappedDataKeyPayload): Promise<void> {
  const res = await fetch("/api/e2ee/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new E2EEError("Unable to save wrapped data key", "SERVER_KEY_SAVE_FAILED");
}

export async function initializeE2EEAccount(userId: string): Promise<E2EEInitializationResult> {
  const recoveryKey = generateRecoveryKey();
  const masterKey = await importMasterKeyFromRecovery(recoveryKey);
  const dataKey = await generateDataKey();
  const keyVersion = 1;
  const wrappedDataKey = await wrapDataKey(dataKey, masterKey, keyVersion);
  await saveServerWrappedDataKey(wrappedDataKey);

  const deviceKey = await generateDeviceKey();
  const wrappedMasterKey = await wrapMasterKeyForDevice(masterKey, deviceKey);
  await saveTrustedDevice({ userId, keyVersion, wrappedMasterKey, createdAt: Date.now() }, deviceKey);

  activeDataKey = dataKey;
  activeVersion = keyVersion;

  return { recoveryKey, keyVersion, wrappedDataKey };
}

export async function unlockAfterLogin(userId: string): Promise<UnlockResult> {
  const serverRecord = await fetchServerKeyRecord();
  const trusted = await loadTrustedDevice(userId);
  if (!trusted || trusted.trust.keyVersion !== serverRecord.keyVersion) throw new UnlockRequiredError();

  const masterKey = await unwrapMasterKeyFromDevice(trusted.trust.wrappedMasterKey, trusted.key);
  const dataKey = await unwrapDataKey(serverRecord.wrappedDataKey, masterKey);
  activeDataKey = dataKey;
  activeVersion = serverRecord.keyVersion;
  return { keyVersion: serverRecord.keyVersion, source: "device" };
}

export async function unlockWithRecoveryKey(userId: string, recoveryKey: string): Promise<UnlockResult> {
  const serverRecord = await fetchServerKeyRecord();
  const masterKey = await importMasterKeyFromRecovery(recoveryKey);
  const dataKey = await unwrapDataKey(serverRecord.wrappedDataKey, masterKey);

  const deviceKey = await generateDeviceKey();
  const wrappedMasterKey = await wrapMasterKeyForDevice(masterKey, deviceKey);
  await saveTrustedDevice(
    { userId, keyVersion: serverRecord.keyVersion, wrappedMasterKey, createdAt: Date.now() },
    deviceKey,
  );

  activeDataKey = dataKey;
  activeVersion = serverRecord.keyVersion;
  return { keyVersion: serverRecord.keyVersion, source: "recovery" };
}

export async function rotateRecoveryKey(userId: string, oldRecoveryKey: string): Promise<RotationResult> {
  if (!activeDataKey) throw new E2EEError("Cannot rotate key before unlock", "NOT_UNLOCKED");

  const serverRecord = await fetchServerKeyRecord();
  const oldMasterKey = await importMasterKeyFromRecovery(oldRecoveryKey);
  await unwrapDataKey(serverRecord.wrappedDataKey, oldMasterKey);

  const newRecoveryKey = generateRecoveryKey();
  const newMasterKey = await importMasterKeyFromRecovery(newRecoveryKey);
  const newVersion = activeVersion + 1;
  const wrappedDataKey = await wrapDataKey(activeDataKey, newMasterKey, newVersion);
  await saveServerWrappedDataKey(wrappedDataKey);

  const deviceKey = await generateDeviceKey();
  const wrappedMasterKey = await wrapMasterKeyForDevice(newMasterKey, deviceKey);
  await saveTrustedDevice({ userId, keyVersion: newVersion, wrappedMasterKey, createdAt: Date.now() }, deviceKey);

  const previousVersion = activeVersion;
  activeVersion = newVersion;
  return {
    oldKeyVersion: previousVersion,
    newKeyVersion: newVersion,
    newRecoveryKey,
    wrappedDataKey,
  };
}
