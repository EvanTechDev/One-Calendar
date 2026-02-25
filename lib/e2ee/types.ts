export type B64 = string;

export interface AesGcmEnvelope {
  ciphertext: B64;
  iv: B64;
}

export interface WrappedDataKeyPayload extends AesGcmEnvelope {
  alg: "AES-GCM";
  keyVersion: number;
}

export interface TrustedDeviceRecord {
  userId: string;
  keyVersion: number;
  wrappedMasterKey: AesGcmEnvelope;
  createdAt: number;
}

export interface ServerKeyRecord {
  userId: string;
  wrappedDataKey: WrappedDataKeyPayload;
  keyVersion: number;
  updatedAt: string;
}

export interface E2EEInitializationResult {
  recoveryKey: string;
  keyVersion: number;
  wrappedDataKey: WrappedDataKeyPayload;
}

export interface UnlockResult {
  keyVersion: number;
  source: "device" | "recovery";
}

export interface RotationResult {
  oldKeyVersion: number;
  newKeyVersion: number;
  newRecoveryKey: string;
  wrappedDataKey: WrappedDataKeyPayload;
}
