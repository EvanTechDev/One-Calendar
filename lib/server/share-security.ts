import crypto from "crypto";
import { Pool } from "pg";

const ALGORITHM = "aes-256-gcm";
const ONE_DAY_SECONDS = 60 * 60 * 24;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export type ShareRow = {
  encrypted_data: string;
  iv: string;
  auth_tag: string;
  timestamp: Date;
  is_protected: boolean;
  is_burn: boolean;
  enc_version: number | null;
};

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

export function keyV2Unprotected(shareId: string) {
  return crypto.createHash("sha256").update(shareId, "utf8").digest();
}

export function keyV3Password(passwordHash: string, shareId: string) {
  return crypto.scryptSync(passwordHash, shareId, 32);
}

export function keyV1Legacy(shareId: string) {
  const salt = process.env.SALT;
  if (!salt) throw new Error("SALT environment variable is not set");
  return crypto.scryptSync(shareId, salt, 32);
}

export function encryptWithKey(data: string, key: Buffer): { encryptedData: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return { encryptedData: encrypted, iv: iv.toString("hex"), authTag: authTag.toString("hex") };
}

export function decryptWithKey(encryptedData: string, iv: string, authTag: string, key: Buffer): string {
  const ivBuffer = Buffer.from(iv, "hex");
  const authTagBuffer = Buffer.from(authTag, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export async function initializeShareDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shares (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        share_id VARCHAR(255) NOT NULL,
        encrypted_data TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        is_protected BOOLEAN DEFAULT FALSE,
        is_burn BOOLEAN DEFAULT FALSE,
        enc_version INTEGER,
        UNIQUE(share_id)
      )
    `);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS user_id TEXT`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_protected BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS is_burn BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE shares ADD COLUMN IF NOT EXISTS enc_version INTEGER`);
    await client.query(`UPDATE shares SET enc_version = 1 WHERE enc_version IS NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shares_user_id ON shares(user_id)`);
  } finally {
    client.release();
  }
}

export function isValidSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

type ShareTokenPayload = {
  sid: string;
  ph: string;
  exp: number;
  iat: number;
};

function getJwtSecret() {
  const secret = process.env.SHARE_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SHARE_JWT_SECRET must be set and at least 32 characters long");
  }
  return secret;
}

export function createShareAccessToken(shareId: string, passwordHash: string, ttlSeconds = ONE_DAY_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload: ShareTokenPayload = {
    sid: shareId,
    ph: passwordHash,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

export function verifyShareAccessToken(token: string): ShareTokenPayload | null {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const actualSignature = fromBase64Url(encodedSignature);

  if (actualSignature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as ShareTokenPayload;
  const now = Math.floor(Date.now() / 1000);

  if (!payload?.sid || !isValidSha256Hex(payload?.ph) || typeof payload.exp !== "number") return null;
  if (payload.exp <= now) return null;

  return payload;
}

export async function withShareClient<T>(handler: (client: Awaited<ReturnType<typeof pool.connect>>) => Promise<T>) {
  const client = await pool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
}
