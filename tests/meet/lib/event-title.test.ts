import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'node:crypto'
import { readEventTitle } from '@/lib/event-title'

const SALT = 'test-salt-at-least-16-chars'
const ROW_ID = 'event-row-1'

/** Mirrors the calendar app's encryptField for fixture generation. */
function encrypt(rowId: string, plaintext: string, salt = SALT): string {
  const key = Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(salt, 'utf8'),
      Buffer.from(rowId, 'utf8'),
      'field-encryption',
      32,
    ),
  )
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let ct = cipher.update(plaintext, 'utf8', 'hex')
  ct += cipher.final('hex')
  return JSON.stringify({
    ct,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  })
}

describe('readEventTitle', () => {
  const original = process.env.SALT

  beforeEach(() => {
    process.env.SALT = SALT
  })

  afterEach(() => {
    process.env.SALT = original
  })

  it('decrypts a title written by the calendar', () => {
    const stored = encrypt(ROW_ID, 'Weekly planning')
    expect(readEventTitle(ROW_ID, stored)).toBe('Weekly planning')
  })

  it('passes legacy plaintext through unchanged', () => {
    expect(readEventTitle(ROW_ID, 'Plain title')).toBe('Plain title')
  })

  it('never surfaces ciphertext when the key is wrong', () => {
    const stored = encrypt(ROW_ID, 'Weekly planning', 'a-different-salt-1234')
    const result = readEventTitle(ROW_ID, stored)
    expect(result).toBe('Untitled meeting')
    expect(result).not.toContain('"ct"')
  })

  it('never surfaces ciphertext when the row id does not match', () => {
    const stored = encrypt('another-row', 'Weekly planning')
    expect(readEventTitle(ROW_ID, stored)).toBe('Untitled meeting')
  })

  it('never surfaces ciphertext when SALT is missing', () => {
    const stored = encrypt(ROW_ID, 'Weekly planning')
    delete process.env.SALT
    expect(readEventTitle(ROW_ID, stored)).toBe('Untitled meeting')
  })

  it('rejects an unsupported envelope version', () => {
    const stored = JSON.parse(encrypt(ROW_ID, 'Weekly planning'))
    stored.v = 99
    expect(readEventTitle(ROW_ID, JSON.stringify(stored))).toBe(
      'Untitled meeting',
    )
  })

  it('treats a JSON object that is not our envelope as plaintext', () => {
    expect(readEventTitle(ROW_ID, '{"foo":1}')).toBe('{"foo":1}')
  })
})
