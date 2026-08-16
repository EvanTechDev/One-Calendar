import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  bookmarkEvent,
  listBookmarkedEvents,
  removeBookmark,
} from '@/lib/mcp/bookmark-tools'

const state = vi.hoisted(() => {
  const COLUMNS: Record<string, string[]> = {
    bookmarked_events: ['id', 'userId', 'eventId', 'createdAt'],
    calendar_events: [
      'id',
      'userId',
      'title',
      'description',
      'location',
      'startDate',
      'endDate',
      'isAllDay',
      'status',
      'color',
      'categoryId',
      'participants',
      'notificationMinutes',
      'createdAt',
      'updatedAt',
    ],
    event_invites: [
      'id',
      'eventId',
      'email',
      'status',
      'inviteToken',
      'emailSent',
      'addedToCalendar',
      'categoryId',
      'expiresAt',
      'createdAt',
      'updatedAt',
    ],
    user: ['id', 'name', 'email'],
  }

  const store: Record<string, Record<string, unknown>[]> = {}
  for (const name of Object.keys(COLUMNS)) store[name] = []

  const isCol = (
    v: unknown,
  ): v is { __col: true; table: string; name: string } =>
    !!v && typeof v === 'object' && (v as { __col?: boolean }).__col === true

  const isTable = (v: unknown): v is { __table: string } =>
    !!v &&
    typeof v === 'object' &&
    typeof (v as { __table?: unknown }).__table === 'string'

  type Row = Record<string, Record<string, unknown>>

  interface Cond {
    op?: string
    conds?: unknown[]
    left?: unknown
    right?: unknown
  }

  function colValue(row: Row, col: unknown): unknown {
    if (isCol(col)) {
      if (row[col.table] !== undefined) return row[col.table][col.name]
      return undefined
    }
    return col
  }

  function matches(cond: unknown, row: Row): boolean {
    const c = cond as Cond | null
    if (!c || typeof c !== 'object') return false
    if (c.op === 'and') return (c.conds ?? []).every((sub) => matches(sub, row))
    if (c.op === 'eq') return colValue(row, c.left) === colValue(row, c.right)
    return false
  }

  function selectRows(q: {
    table: string
    join?: { table: string; cond?: unknown }
    where?: unknown
    order?: { col: unknown; dir: 'asc' | 'desc' }[]
    limit?: number
    offset?: number
  }): Row[] {
    let rows: Row[] = (store[q.table] ?? []).map((r) => ({ [q.table]: r }))
    if (q.join) {
      const joined: Row[] = []
      for (const l of store[q.table]) {
        for (const r of store[q.join.table]) {
          joined.push({ [q.table]: l, [q.join.table]: r } as Row)
        }
      }
      rows = q.join.cond
        ? joined.filter((row) => matches(q.join.cond, row))
        : joined
    }
    if (q.where) rows = rows.filter((row) => matches(q.where, row))
    if (q.order && q.order.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const o of q.order) {
          const av = colValue(a, o.col)
          const bv = colValue(b, o.col)
          let cmp = 0
          if (av instanceof Date && bv instanceof Date) {
            cmp = av.getTime() - bv.getTime()
          } else if (av === null && bv !== null) {
            cmp = -1
          } else if (av !== null && bv === null) {
            cmp = 1
          } else if (av < bv) {
            cmp = -1
          } else if (av > bv) {
            cmp = 1
          }
          if (cmp !== 0) return o.dir === 'desc' ? -cmp : cmp
        }
        return 0
      })
    }
    if (q.offset) rows = rows.slice(q.offset)
    if (q.limit !== undefined) rows = rows.slice(0, q.limit)
    return rows
  }

  const isCount = (v: unknown) =>
    !!v && typeof v === 'object' && (v as { op?: string }).op === 'count'

  function select(projection?: Record<string, unknown>) {
    const q: {
      table: string
      join?: { table: string; cond?: unknown }
      where?: unknown
      order?: { col: unknown; dir: 'asc' | 'desc' }[]
      limit?: number
      offset?: number
    } = { table: '' }
    const chain: Record<string, unknown> = {}
    chain.from = (t: { __table: string }) => {
      q.table = t.__table
      return chain
    }
    chain.innerJoin = (t: { __table: string }, cond: unknown) => {
      q.join = { table: t.__table, cond }
      return chain
    }
    chain.where = (cond: unknown) => {
      q.where = cond
      return chain
    }
    chain.orderBy = (...cols: unknown[]) => {
      q.order = cols.map((c) => {
        const marker = c as { op?: string; col?: unknown } | null
        if (marker && (marker.op === 'asc' || marker.op === 'desc')) {
          return { col: marker.col, dir: marker.op }
        }
        return { col: c, dir: 'asc' as const }
      })
      return chain
    }
    chain.limit = (n: number) => {
      q.limit = n
      return chain
    }
    chain.offset = (n: number) => {
      q.offset = n
      return chain
    }
    chain.then = (resolve: (value: unknown) => void) => {
      const rows = selectRows(q)
      if (projection && Object.values(projection).some(isCount)) {
        const out: Record<string, number> = {}
        for (const [key, val] of Object.entries(projection)) {
          if (isCount(val)) out[key] = rows.length
        }
        resolve([out])
        return
      }
      if (!projection || Object.keys(projection).length === 0) {
        resolve(rows.map((row) => row[q.table]))
        return
      }
      const out = rows.map((row) => {
        const item: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(projection)) {
          if (isTable(val)) item[key] = row[val.__table]
          else if (isCol(val)) item[key] = colValue(row, val)
        }
        return item
      })
      resolve(out)
    }
    return chain
  }

  function insert(table: string) {
    const chain: Record<string, unknown> = {}
    chain.values = (v: Record<string, unknown>) => {
      chain.__values = v
      return chain
    }
    chain.onConflictDoNothing = () => {
      chain.__idempotent = true
      return chain
    }
    chain.returning = () => {
      const vals = chain.__values as Record<string, unknown>
      const rows = store[table]
      if (
        chain.__idempotent &&
        rows.some((r) => r.userId === vals.userId && r.eventId === vals.eventId)
      ) {
        return Promise.resolve([])
      }
      const row = { ...vals, createdAt: vals.createdAt ?? new Date() }
      rows.push(row)
      return Promise.resolve([row])
    }
    return chain
  }

  function del(table: string) {
    const chain: Record<string, unknown> = {}
    chain.where = (cond: unknown) => {
      chain.__where = cond
      return chain
    }
    chain.then = (resolve: (value: unknown) => void) => {
      const cond = chain.__where
      store[table] = store[table].filter((r) => !matches(cond, { [table]: r }))
      resolve(undefined)
    }
    return chain
  }

  const db = {
    select,
    insert: (t: { __table: string }) => insert(t.__table),
    delete: (t: { __table: string }) => del(t.__table),
  }

  return { db, store, columns: COLUMNS }
})

vi.mock('drizzle-orm', () => {
  const eq = (left: unknown, right: unknown) => ({ op: 'eq', left, right })
  const and = (...conds: unknown[]) => ({ op: 'and', conds })
  const desc = (col: unknown) => ({ op: 'desc', col })
  const sql = (strings: TemplateStringsArray) => ({
    op: 'count',
    sql: strings.join(''),
  })
  return { eq, and, desc, sql }
})

vi.mock('@/lib/drizzle/schema', () => {
  const mk = (name: string) => {
    const t: Record<string, unknown> = { __table: name }
    for (const col of state.columns[name]) {
      t[col] = { __col: true, table: name, name: col }
    }
    return t
  }
  return {
    bookmarkedEvents: mk('bookmarked_events'),
    calendarEvents: mk('calendar_events'),
    eventInvites: mk('event_invites'),
    user: mk('user'),
  }
})

vi.mock('@/lib/drizzle/client', () => ({
  getDb: () => state.db,
}))

vi.mock('@/lib/api-helpers', () => ({
  decryptEvent: (event: unknown) => ({ ...(event as object) }),
}))

function seedUser(id: string, email: string) {
  state.store.user.push({ id, name: 'User', email })
}

function seedEvent(overrides: Record<string, unknown> = {}) {
  const row = {
    id: 'evt-1',
    userId: 'u1',
    title: 'Standup',
    description: null,
    location: null,
    startDate: new Date('2026-08-15T09:00:00Z'),
    endDate: new Date('2026-08-15T10:00:00Z'),
    isAllDay: false,
    status: 'confirmed',
    color: 'bg-[#E6F6FD]',
    categoryId: null,
    participants: null,
    notificationMinutes: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  }
  state.store.calendar_events.push(row)
  return row
}

function seedBookmark(
  id: string,
  userId: string,
  eventId: string,
  createdAt: Date,
) {
  state.store.bookmarked_events.push({ id, userId, eventId, createdAt })
}

beforeEach(() => {
  for (const rows of Object.values(state.store)) rows.length = 0
})

describe('bookmarkEvent', () => {
  it('creates a bookmark for an owned event', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u1', title: 'Standup' })

    const bm = await bookmarkEvent('u1', { eventId: 'evt-1' })

    expect(bm).toMatchObject({ userId: 'u1', eventId: 'evt-1' })
    expect(bm.id).toBeTruthy()
    expect(bm.createdAt).toBeInstanceOf(Date)
    expect(state.store.bookmarked_events).toHaveLength(1)
  })

  it('creates a bookmark for a valid invited event', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u2' })
    state.store.event_invites.push({
      id: 'inv-1',
      eventId: 'evt-1',
      email: 'owner@example.com',
      addedToCalendar: true,
      expiresAt: new Date(Date.now() + 86400000),
    })

    const bm = await bookmarkEvent('u1', { eventId: 'evt-1' })

    expect(bm).toMatchObject({ userId: 'u1', eventId: 'evt-1' })
  })

  it('returns the existing bookmark on a second bookmark (no duplicates)', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u1' })

    const first = await bookmarkEvent('u1', { eventId: 'evt-1' })
    const second = await bookmarkEvent('u1', { eventId: 'evt-1' })

    expect(second.id).toBe(first.id)
    expect(second).toMatchObject({
      userId: 'u1',
      eventId: 'evt-1',
      id: first.id,
    })
    expect(state.store.bookmarked_events).toHaveLength(1)
  })

  it('throws Forbidden when the event is not viewable', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-other', userId: 'u2', title: 'Private' })

    await expect(bookmarkEvent('u1', { eventId: 'evt-other' })).rejects.toThrow(
      'Forbidden',
    )
    expect(state.store.bookmarked_events).toHaveLength(0)
  })

  it('throws Forbidden on an expired invite', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u2' })
    state.store.event_invites.push({
      id: 'inv-1',
      eventId: 'evt-1',
      email: 'owner@example.com',
      addedToCalendar: true,
      expiresAt: new Date(Date.now() - 86400000),
    })

    await expect(bookmarkEvent('u1', { eventId: 'evt-1' })).rejects.toThrow(
      'Forbidden',
    )
  })
})

describe('listBookmarkedEvents', () => {
  it('returns decrypted events for owned bookmarks, redacted for non-viewable invited ones', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({
      id: 'evt-owned',
      userId: 'u1',
      title: 'My Meeting',
      description: 'desc-1',
      location: 'Room 1',
      participants: ['a@example.com'],
    })
    seedEvent({ id: 'evt-hidden', userId: 'u2', title: 'Their Secret' })
    state.store.event_invites.push({
      id: 'inv-1',
      eventId: 'evt-hidden',
      email: 'owner@example.com',
      addedToCalendar: false,
      expiresAt: null,
    })
    seedBookmark('bm-1', 'u1', 'evt-owned', new Date('2026-08-11T00:00:00Z'))
    seedBookmark('bm-2', 'u1', 'evt-hidden', new Date('2026-08-10T00:00:00Z'))

    const res = await listBookmarkedEvents('u1', {})

    expect(res).toMatchObject({ total: 2, page: 1, limit: 20 })
    expect(res.bookmarks).toHaveLength(2)
    const [owned, hidden] = res.bookmarks
    expect(owned.id).toBe('bm-1')
    expect(owned).toMatchObject({ eventId: 'evt-owned' })
    expect(owned.createdAt).toBeInstanceOf(Date)
    expect(owned.event).toMatchObject({
      id: 'evt-owned',
      title: 'My Meeting',
      description: 'desc-1',
      location: 'Room 1',
      participants: ['a@example.com'],
    })
    expect(hidden.id).toBe('bm-2')
    expect(hidden.event.title).toBeUndefined()
    expect(hidden.event.description).toBeUndefined()
    expect(hidden.event.location).toBeUndefined()
    expect(hidden.event.participants).toEqual([])
    expect(hidden.event.id).toBe('evt-hidden')
  })

  it('returns decrypted events for viewable invited events', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-inv', userId: 'u2', title: 'Shared Event' })
    state.store.event_invites.push({
      id: 'inv-1',
      eventId: 'evt-inv',
      email: 'owner@example.com',
      addedToCalendar: true,
      expiresAt: null,
    })
    seedBookmark('bm-1', 'u1', 'evt-inv', new Date('2026-08-10T00:00:00Z'))

    const res = await listBookmarkedEvents('u1', {})

    expect(res.bookmarks[0].event.title).toBe('Shared Event')
  })

  it('filters by eventId and paginates', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u1' })
    seedEvent({ id: 'evt-2', userId: 'u1' })
    seedEvent({ id: 'evt-3', userId: 'u1' })
    seedBookmark('bm-1', 'u1', 'evt-1', new Date('2026-08-11T00:00:00Z'))
    seedBookmark('bm-2', 'u1', 'evt-2', new Date('2026-08-10T00:00:00Z'))
    seedBookmark('bm-3', 'u1', 'evt-3', new Date('2026-08-09T00:00:00Z'))

    const filtered = await listBookmarkedEvents('u1', { eventId: 'evt-2' })
    expect(filtered.total).toBe(1)
    expect(filtered.bookmarks).toHaveLength(1)
    expect(filtered.bookmarks[0].eventId).toBe('evt-2')

    const paged = await listBookmarkedEvents('u1', { page: 2, limit: 2 })
    expect(paged.total).toBe(3)
    expect(paged.bookmarks).toHaveLength(1)
    expect(paged.bookmarks[0].id).toBe('bm-3')

    const capped = await listBookmarkedEvents('u1', { limit: 500 })
    expect(capped.limit).toBe(100)
  })
})

describe('removeBookmark', () => {
  it('deletes the bookmark and is idempotent', async () => {
    seedUser('u1', 'owner@example.com')
    seedEvent({ id: 'evt-1', userId: 'u1' })
    seedBookmark('bm-1', 'u1', 'evt-1', new Date('2026-08-10T00:00:00Z'))

    await expect(removeBookmark('u1', { eventId: 'evt-1' })).resolves.toEqual({
      success: true,
    })
    expect(state.store.bookmarked_events).toHaveLength(0)

    await expect(removeBookmark('u1', { eventId: 'evt-1' })).resolves.toEqual({
      success: true,
    })
  })

  it('does not remove another users bookmark', async () => {
    seedBookmark('bm-1', 'u1', 'evt-1', new Date('2026-08-10T00:00:00Z'))
    seedBookmark('bm-2', 'u2', 'evt-1', new Date('2026-08-10T00:00:00Z'))

    await removeBookmark('u1', { eventId: 'evt-1' })

    expect(state.store.bookmarked_events).toHaveLength(1)
    expect(state.store.bookmarked_events[0].id).toBe('bm-2')
  })
})
