import type { TrustedDeviceRecord } from "@/lib/e2ee/types";

const DB_NAME = "one-calendar-e2ee";
const DB_VERSION = 1;
const DEVICE_STORE = "trusted_devices";
const KEY_STORE = "device_keys";

interface DeviceKeyRecord {
  userId: string;
  keyVersion: number;
  key: CryptoKey;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEVICE_STORE)) db.createObjectStore(DEVICE_STORE, { keyPath: "userId" });
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE, { keyPath: "userId" });
    };
  });
}

async function put<T>(store: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(store).put(value as any);
  });
}

async function get<T>(store: string, key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
  });
}

export async function saveTrustedDevice(record: TrustedDeviceRecord, deviceKey: CryptoKey): Promise<void> {
  await put(DEVICE_STORE, record);
  await put(KEY_STORE, { userId: record.userId, keyVersion: record.keyVersion, key: deviceKey } satisfies DeviceKeyRecord);
}

export async function loadTrustedDevice(userId: string): Promise<{ trust: TrustedDeviceRecord; key: CryptoKey } | null> {
  const trust = await get<TrustedDeviceRecord>(DEVICE_STORE, userId);
  const key = await get<DeviceKeyRecord>(KEY_STORE, userId);
  if (!trust || !key) return null;
  return { trust, key: key.key };
}
