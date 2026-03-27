export type DsSignedPayload = {
  method: string;
  path: string;
  timestamp: string;
  body: string;
};

export type ShareRow = {
  id: string;
  did: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  createdAt: string;
};

export type CalendarDataRow = {
  id: string;
  did: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  updatedAt: string;
};

export type EventCipherRecord = {
  id: string;
  ciphertext: string;
  iv: string;
  authTag: string;
  updatedAt: string;
};

export type MigrateBundle = {
  shares: ShareRow[];
  calendarData: CalendarDataRow[];
};
