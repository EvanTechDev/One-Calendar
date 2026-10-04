// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getFakeDb } from '../api/route-test-db'
vi.hoisted(() => {
  process.env.SALT = 'override-conflict-test-salt'
})
vi.mock('drizzle-orm', async (original) => ({
  ...(await original<typeof import('drizzle-orm')>()),
  ...(await import('../api/route-test-db')).drizzleOperatorsMock,
}))
vi.mock('@/lib/drizzle/client', () => ({ getDb: () => getFakeDb().db }))
import { writeInstanceOverride, type EventWriteDb } from '@/lib/event-write'
import { decryptFieldStrict } from '@/lib/field-crypto'

const fake = getFakeDb()
beforeEach(() => {
  fake.reset()
})
afterEach(() => vi.unstubAllEnvs())

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
