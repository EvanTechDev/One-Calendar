export interface SignedRequestHeaders {
  "X-DID": string;
  "X-Timestamp": string;
  "X-Signature": string;
}

export interface DsEventRecord {
  id: string;
  did: string;
  payloadCiphertext: string;
  createdAt: string;
  updatedAt: string;
}

export interface DsShareRecord {
  id: string;
  did: string;
  ciphertext: string;
  metadataCiphertext: string | null;
  createdAt: string;
}

export interface DsCalendarBackupRecord {
  id: string;
  did: string;
  ciphertext: string;
  createdAt: string;
}

export interface DsExportPayload {
  shares: DsShareRecord[];
  calendarBackups: DsCalendarBackupRecord[];
}
