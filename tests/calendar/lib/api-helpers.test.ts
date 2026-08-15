import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.SALT = 'test-salt-value-at-least-16-chars!!'
})

describe('api-helpers', () => {
  it('decryptEvent decrypts encrypted fields', async () => {
    const { encryptField } = await import('@/lib/field-crypto')
    const { decryptEvent } = await import('@/lib/api-helpers')

    const eventId = 'evt-decrypt-test'
    const event = {
      id: eventId,
      userId: 'user-1',
      title: encryptField(eventId, 'My Event Title')!,
      description: encryptField(eventId, 'A description'),
      location: encryptField(eventId, 'Room 101'),
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-01T01:00:00'),
      isAllDay: false,
      color: 'blue',
      categoryId: null,
      participants: null,
      notificationMinutes: 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const decrypted = decryptEvent(event as any)
    expect(decrypted.title).toBe('My Event Title')
    expect(decrypted.description).toBe('A description')
    expect(decrypted.location).toBe('Room 101')
    expect(decrypted.id).toBe(eventId)
  }, 60000)

  it('decryptEvent returns null fields as null', async () => {
    const { decryptEvent } = await import('@/lib/api-helpers')

    const event = {
      id: 'evt-null-fields',
      userId: 'user-1',
      title: 'plain-title',
      description: null,
      location: null,
      startDate: new Date(),
      endDate: new Date(),
      isAllDay: false,
      color: null,
      categoryId: null,
      participants: null,
      notificationMinutes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const decrypted = decryptEvent(event as any)
    expect(decrypted.title).toBe('plain-title')
    expect(decrypted.description).toBeNull()
    expect(decrypted.location).toBeNull()
  }, 30000)

  it('decryptEvent falls back to encrypted value on decrypt failure', async () => {
    const { decryptEvent } = await import('@/lib/api-helpers')

    const event = {
      id: 'evt-fallback',
      userId: 'user-1',
      title: '{"ct":"bad","iv":"bad","tag":"bad"}',
      description: null,
      location: null,
      startDate: new Date(),
      endDate: new Date(),
      isAllDay: false,
      color: null,
      categoryId: null,
      participants: null,
      notificationMinutes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const decrypted = decryptEvent(event as any)
    expect(decrypted.title).toBe('{"ct":"bad","iv":"bad","tag":"bad"}')
  })
})
