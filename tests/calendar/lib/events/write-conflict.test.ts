import { mock as moduleMock } from 'bun:test'
import { unstubAllEnvs } from '../../../support/stubs'
import { afterEach, beforeEach, expect, it, vi } from 'bun:test'
import { getFakeDb } from '../../api/route-test-db'
;(() => {
  process.env.SALT = 'override-conflict-test-salt'
})()
const nativeOriginal1 = { ...(await import('drizzle-orm')) }
moduleMock.module('drizzle-orm', async () => ({
  ...nativeOriginal1,
  ...(await import('../../api/route-test-db')).drizzleOperatorsMock,
}))
moduleMock.module('@/lib/drizzle/client', () => ({
  getDb: () => getFakeDb().db,
}))
const { writeInstanceOverride } = await import('@/lib/events/write')

const { decryptFieldStrict } = await import('@/lib/field-crypto')

import type { EventWriteDb } from '@/lib/events/write'

const fake = getFakeDb()
beforeEach(() => {
  fake.reset()
})
afterEach(() => unstubAllEnvs())

it('keeps one decryptable row when independently planned inserts collide', async () => {
  const fields = {
    title: 'first',
    description: 'private',
    location: 'room',
    participants: [{ email: 'guest@example.com' }],
    startDate: new Date('2026-01-06T14:00Z'),
    endDate: new Date('2026-01-06T15:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    isAllDay: false,
  }
  const upsert = {
    id: 'winner',
    seriesId: 'master',
    recurrenceId: '20260106T140000Z',
    isNew: true,
    fields,
  }
  // Both plans precede either insert. The fake evaluates the actual unique
  // target; real crypto verifies the losing request used the persisted ID.
  await Promise.all([
    writeInstanceOverride(fake.db as EventWriteDb, 'owner', upsert),
    writeInstanceOverride(fake.db as EventWriteDb, 'owner', {
      ...upsert,
      id: 'loser',
      fields: { ...fields, title: 'second' },
    }),
  ])
  expect(fake.rows()).toHaveLength(1)
  const row = fake.rows()[0]
  expect(row.id).toBe('winner')
  expect(decryptFieldStrict(row.id as string, row.title as string)).toBe(
    'second',
  )
  expect(decryptFieldStrict(row.id as string, row.description as string)).toBe(
    'private',
  )
  expect(decryptFieldStrict(row.id as string, row.location as string)).toBe(
    'room',
  )
  expect(
    JSON.parse(
      decryptFieldStrict(row.id as string, row.participants as string)!,
    ),
  ).toEqual(fields.participants)
})
