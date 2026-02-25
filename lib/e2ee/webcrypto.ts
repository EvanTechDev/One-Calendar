import type { AesGcmEnvelope, WrappedDataKeyPayload } from "@/lib/e2ee/types";
import { E2EEError } from "@/lib/e2ee/errors";

const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromB64(value: string): ArrayBuffer {
  const bytes = new Uint8Array(atob(value).split("").map((c) => c.charCodeAt(0)));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createIv(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

function normalizeRecoveryInput(input: string): Uint8Array {
  const cleaned = input.replace(/-/g, "").trim();
  try {
    const bytes = new Uint8Array(fromB64(cleaned));
    if (bytes.byteLength !== 32) throw new Error("invalid length");
    return bytes;
  } catch {
    throw new E2EEError("Invalid recovery key format", "INVALID_RECOVERY_KEY");
  }
}

export function formatRecoveryKey(raw: Uint8Array): string {
  const compact = toB64(raw);
  return compact.match(/.{1,8}/g)?.join("-") ?? compact;
}

export function generateRecoveryKey(): string {
  return formatRecoveryKey(crypto.getRandomValues(new Uint8Array(32)));
}

export async function importMasterKeyFromRecovery(recoveryKey: string): Promise<CryptoKey> {
  const bytes = normalizeRecoveryInput(recoveryKey);
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function generateDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function encryptRawKey(keyToExport: CryptoKey, wrappingKey: CryptoKey): Promise<AesGcmEnvelope> {
  const iv = createIv();
  const raw = await crypto.subtle.exportKey("raw", keyToExport);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, raw);
  return { ciphertext: toB64(new Uint8Array(ciphertext)), iv: toB64(iv) };
}

async function decryptRawKey(envelope: AesGcmEnvelope, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv) },
    wrappingKey,
    fromB64(envelope.ciphertext),
  );
}

export async function wrapDataKey(dataKey: CryptoKey, masterKey: CryptoKey, keyVersion: number): Promise<WrappedDataKeyPayload> {
  const wrapped = await encryptRawKey(dataKey, masterKey);
  return { ...wrapped, alg: "AES-GCM", keyVersion };
}

export async function unwrapDataKey(wrappedDataKey: WrappedDataKeyPayload, masterKey: CryptoKey): Promise<CryptoKey> {
  const raw = await decryptRawKey(wrappedDataKey, masterKey);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function wrapMasterKeyForDevice(masterKey: CryptoKey, deviceKey: CryptoKey): Promise<AesGcmEnvelope> {
  return encryptRawKey(masterKey, deviceKey);
}

export async function unwrapMasterKeyFromDevice(envelope: AesGcmEnvelope, deviceKey: CryptoKey): Promise<CryptoKey> {
  const raw = await decryptRawKey(envelope, deviceKey);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function encryptBusinessData(dataKey: CryptoKey, payload: unknown): Promise<AesGcmEnvelope> {
  const iv = createIv();
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dataKey, plaintext);
  return { ciphertext: toB64(new Uint8Array(ciphertext)), iv: toB64(iv) };
}

export async function decryptBusinessData<T>(dataKey: CryptoKey, envelope: AesGcmEnvelope): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv) },
    dataKey,
    fromB64(envelope.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
