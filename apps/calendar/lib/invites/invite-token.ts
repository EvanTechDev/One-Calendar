import crypto from 'crypto'
import {
  decryptFieldStrict,
  encryptField,
  looksLikeEnvelope,
} from '@/lib/field-crypto'

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashInviteToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export function encryptInviteToken(rowId: string, rawToken: string): string {
  const encrypted = encryptField(rowId, rawToken)
  if (!encrypted) throw new Error('Failed to encrypt Invite Token')
  return encrypted
}

export function decryptInviteToken(row: {
  id: string
  inviteToken: string
  inviteTokenHash?: string | null
}): string {
  if (row.inviteTokenHash && !looksLikeEnvelope(row.inviteToken)) {
    throw new Error(`Protected Invite Token invariant failed for ${row.id}`)
  }
  const rawToken = decryptFieldStrict(row.id, row.inviteToken)
  if (!rawToken) throw new Error('Failed to decrypt Invite Token')
  return rawToken
}

export function protectInviteToken(rowId: string, rawToken: string) {
  return {
    inviteToken: encryptInviteToken(rowId, rawToken),
    inviteTokenHash: hashInviteToken(rawToken),
  }
}
