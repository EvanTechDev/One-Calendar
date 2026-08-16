import { type NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/drizzle/client'
import { calendarEvents, eventInvites, user } from '@/lib/drizzle/schema'
import { and, eq, gte, inArray, lte, or, desc, isNotNull } from 'drizzle-orm'
import { encryptField, encryptJsonField } from '@/lib/field-crypto'
import crypto from 'crypto'
import { getAuthedUser, decryptEvent } from '@/lib/api-helpers'
import {
  getCachedEvents,
  setCachedEvents,
  invalidateEventCache,
  groupByMonth,
} from '@/lib/cache/events'
import { fullMonthRange } from '@/lib/cache/keys'
import { eventSchema, firstZodMessage } from '@/lib/validation'
import { RRule } from 'rrule'
import {
  expandRows,
  mergeOverride,
  firstStampOfSeries,
  planInstanceChange,
  resolveInstance,
  type ApplyTo,
  type EventRow,
  type InstanceChangePlan,
} from '@/lib/event-service'
import {
  isInstanceId,
  isSeriesEvent,
  parseInstanceId,
  parseRfcStamp,
  withUntil,
} from '@/lib/recurrence/engine'
import { z } from 'zod'
import { dedupeById } from '@/lib/array-mutations'

export const runtime = 'nodejs'

const DEFAULT_EXPANSION_WINDOW_MS = 2 * 365 * 24 * 60 * 60 * 1000

const recurringFieldsSchema = z.object({
  rrule: z.string().max(500).optional(),
  exdate: z.array(z.string()).max(500).optional(),
  apply_to: z.enum(['all', 'single', 'following']).optional(),
})

const APPLY_TO_VALUES = new Set(['all', 'single', 'following'])

type EnrichedInvite = {
  id: string
  email: string
  status: 'pending' | 'accepted' | 'maybe' | 'declined'
  inviteToken: string
  emailSent: boolean
  addedToCalendar: boolean
  userName: string | null
  userImage: string | null
}

function isValidRrule(rule: string | undefined): boolean {
  if (rule === null || rule === undefined) return true
  try {
    return typeof RRule.fromString(rule).options.freq === 'number'
  } catch {
    return false
  }
}

function isValidStamp(stamp: string): boolean {
  try {
    parseRfcStamp(stamp)
    return true
  } catch {
    return false
  }
}

function encryptMergedFields(
  rowId: string,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const encrypted: Record<string, unknown> = {}
  if (fields.title !== undefined)
    encrypted.title = encryptField(rowId, fields.title as string) ?? ''
  if (fields.description !== undefined)
    encrypted.description = encryptField(rowId, fields.description as string)
  if (fields.location !== undefined)
    encrypted.location = encryptField(rowId, fields.location as string)
  if (fields.participants !== undefined)
    encrypted.participants = encryptJsonField(rowId, fields.participants)
  if (fields.startDate !== undefined) encrypted.startDate = fields.startDate
  if (fields.endDate !== undefined) encrypted.endDate = fields.endDate
  if (fields.isAllDay !== undefined) encrypted.isAllDay = fields.isAllDay
  if (fields.status !== undefined) encrypted.status = fields.status
  if (fields.color !== undefined) encrypted.color = fields.color
  if (fields.categoryId !== undefined) encrypted.categoryId = fields.categoryId
  if (fields.notificationMinutes !== undefined)
    encrypted.notificationMinutes = fields.notificationMinutes
  return encrypted
}

async function invalidateMasterCache(
  userId: string,
  seriesId: string,
): Promise<void> {
  const [master] = await getDb()
    .select({
      startDate: calendarEvents.startDate,
      endDate: calendarEvents.endDate,
    })
    .from(calendarEvents)
    .where(
      and(eq(calendarEvents.id, seriesId), eq(calendarEvents.userId, userId)),
    )
  if (master) {
    await invalidateEventCache(
      userId,
      master.startDate.toISOString(),
      master.endDate.toISOString(),
    )
  }
}

async function fetchOverrides(seriesId: string): Promise<EventRow[]> {
  const rows = await getDb()
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.seriesId, seriesId))
  return rows as unknown as EventRow[]
}

async function deleteRow(userId: string, row: EventRow): Promise<void> {
  await getDb().delete(eventInvites).where(eq(eventInvites.eventId, row.id))
  await getDb()
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.id, row.id), eq(calendarEvents.userId, userId)),
    )
  await invalidateEventCache(
    userId,
    row.startDate.toISOString(),
    row.endDate.toISOString(),
  )
}

async function applySplitPlan(
  userId: string,
  plan: InstanceChangePlan,
  master: EventRow,
): Promise<ReturnType<typeof decryptEvent> | null> {
  const split = plan.split!
  const newId = split.newSeries.id
  const fields = encryptMergedFields(newId, split.newSeries.fields)
  const [newMaster] = await getDb()
    .insert(calendarEvents)
    .values({
      id: newId,
      userId,
      rrule: split.newSeries.rrule,
      exdate: split.newSeries.exdate,
      ...fields,
    } as typeof calendarEvents.$inferInsert)
    .returning()

  if (plan.deleteOverrideId) {
    await getDb()
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, plan.deleteOverrideId),
          eq(calendarEvents.userId, userId),
        ),
      )
  }

  if (split.moveOverrideIds.length > 0) {
    await getDb()
      .update(calendarEvents)
      .set({ seriesId: newId })
      .where(
        and(
          inArray(calendarEvents.id, split.moveOverrideIds),
          eq(calendarEvents.userId, userId),
        ),
      )
  }

  await getDb()
    .update(calendarEvents)
    .set({
      rrule: withUntil(master.rrule!, split.masterUntil),
      exdate: split.masterExdate,
      updatedAt: new Date(),
    })
    .where(
      and(eq(calendarEvents.id, master.id), eq(calendarEvents.userId, userId)),
    )

  await Promise.all([
    invalidateEventCache(
      userId,
      master.startDate.toISOString(),
      master.endDate.toISOString(),
    ),
    invalidateEventCache(
      userId,
      split.newSeries.startDate.toISOString(),
      split.newSeries.endDate.toISOString(),
    ),
  ])

  return decryptEvent(newMaster)
}

async function enrichEventsWithInvites(
  events: Array<ReturnType<typeof decryptEvent> & { instanceId?: string }>,
  viewerId: string,
  viewerEmail?: string,
): Promise<
  Array<
    ReturnType<typeof decryptEvent> & {
      invites: EnrichedInvite[]
      instanceId?: string
    }
  >
> {
  if (events.length === 0) {
    return events.map((e) => ({ ...e, invites: [] }))
  }

  const inviteIds = events.map((e) => e.seriesId ?? e.id)
  const idKeys = [...new Set(inviteIds)]
  const eventOwners = new Map(
    events.map((e) => [(e.seriesId ?? e.id) as string, e.userId]),
  )

  const allInvites = await getDb()
    .select({
      id: eventInvites.id,
      eventId: eventInvites.eventId,
      email: eventInvites.email,
      status: eventInvites.status,
      inviteToken: eventInvites.inviteToken,
      emailSent: eventInvites.emailSent,
      addedToCalendar: eventInvites.addedToCalendar,
    })
    .from(eventInvites)
    .where(inArray(eventInvites.eventId, idKeys))

  const inviteEmails = [
    ...new Set(allInvites.map((i) => i.email.toLowerCase())),
  ]

  let userMap: Record<string, { name: string; image: string | null }> = {}
  if (inviteEmails.length > 0) {
    const users = await getDb()
      .select({
        email: user.email,
        name: user.name,
        image: user.image,
      })
      .from(user)
      .where(inArray(user.email, inviteEmails))

    userMap = users.reduce(
      (acc: Record<string, { name: string; image: string | null }>, u) => {
        acc[u.email.toLowerCase()] = { name: u.name, image: u.image }
        return acc
      },
      {} as Record<string, { name: string; image: string | null }>,
    )
  }

  const viewerEmailLower = viewerEmail?.toLowerCase()

  const invitesByEvent = allInvites.reduce(
    (acc: Record<string, EnrichedInvite[]>, invite) => {
      const emailLower = invite.email.toLowerCase()
      const isOwnInvite = emailLower === viewerEmailLower
      const enriched: EnrichedInvite = {
        id: invite.id,
        email: invite.email,
        status: invite.status as 'pending' | 'accepted' | 'maybe' | 'declined',
        inviteToken:
          eventOwners.get(invite.eventId) === viewerId || isOwnInvite
            ? invite.inviteToken
            : '',
        emailSent: invite.emailSent,
        addedToCalendar: invite.addedToCalendar,
        userName: userMap[emailLower]?.name ?? null,
        userImage: userMap[emailLower]?.image ?? null,
      }
      if (!acc[invite.eventId]) acc[invite.eventId] = []
      acc[invite.eventId].push(enriched)
      return acc
    },
    {} as Record<string, EnrichedInvite[]>,
  )

  return events.map((e) => {
    const key = (e.seriesId ?? e.id) as string
    return {
      ...e,
      invites: invitesByEvent[key] ?? [],
    }
  })
}

async function getSharedEvents(currentUser: { email: string }): Promise<
  Array<
    ReturnType<typeof decryptEvent> & {
      viewOnly: boolean
      organizer: {
        name: string
        email: string
        image: string | null
      } | null
    }
  >
> {
  const sharedEventRows = await getDb()
    .select({
      eventId: eventInvites.eventId,
      categoryId: eventInvites.categoryId,
    })
    .from(eventInvites)
    .where(
      and(
        eq(eventInvites.email, currentUser.email.toLowerCase()),
        eq(eventInvites.addedToCalendar, true),
      ),
    )

  if (sharedEventRows.length === 0) return []

  const inviteCategoryByEvent = new Map(
    sharedEventRows.map((r) => [r.eventId, r.categoryId]),
  )
  const sharedIds = sharedEventRows.map((r) => r.eventId)
  const sharedResults = await getDb()
    .select()
    .from(calendarEvents)
    .where(inArray(calendarEvents.id, sharedIds))

  const ownerIds = [...new Set(sharedResults.map((e) => e.userId))]
  const owners = ownerIds.length
    ? await getDb()
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        })
        .from(user)
        .where(inArray(user.id, ownerIds))
    : []

  const ownerMap = new Map(owners.map((u) => [u.id, u]))

  return sharedResults.map((e) => {
    const owner = e.userId ? ownerMap.get(e.userId) : null
    return {
      ...decryptEvent(e),
      categoryId: inviteCategoryByEvent.has(e.id)
        ? (inviteCategoryByEvent.get(e.id) ?? null)
        : e.categoryId,
      viewOnly: true,
      organizer: owner
        ? { name: owner.name, email: owner.email, image: owner.image }
        : null,
    }
  })
}

export const GET = async function GET(request: NextRequest) {
  const currentUser = await getAuthedUser()
  if (!currentUser)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const categoryIds = searchParams.get('categoryIds')

  if (id) {
    const parsedId = isInstanceId(id) ? parseInstanceId(id) : null
    if (parsedId) {
      const [master] = await getDb()
        .select()
        .from(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, parsedId.seriesId),
            eq(calendarEvents.userId, currentUser.id),
          ),
        )
      if (
        !master ||
        !isSeriesEvent({
          rrule: master.rrule,
        })
      ) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      const overrides = (await fetchOverrides(master.id)).map((o) =>
        decryptEvent(o as typeof calendarEvents.$inferSelect),
      )
      const resolved = resolveInstance(
        decryptEvent(master),
        parsedId.recurrenceId,
        overrides,
      )
      if (!resolved) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      const [withInvites] = await enrichEventsWithInvites(
        [
          {
            ...resolved,
            id,
            instanceId: id,
          },
        ],
        currentUser.id,
        currentUser.email,
      )
      return NextResponse.json({ event: withInvites })
    }

    const [row] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.userId, currentUser.id),
        ),
      )
    if (!row) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const [withInvites] = await enrichEventsWithInvites(
      [{ ...decryptEvent(row), instanceId: row.id }],
      currentUser.id,
      currentUser.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  const filters = [eq(calendarEvents.userId, currentUser.id)]

  let decrypted: ReturnType<typeof decryptEvent>[] = []

  if (startDate && endDate) {
    const cached = await getCachedEvents(currentUser.id, startDate, endDate)
    if (cached) {
      decrypted = cached.map(decryptEvent)
    } else {
      const range = fullMonthRange(startDate, endDate)
      filters.push(gte(calendarEvents.startDate, range.start))
      filters.push(lte(calendarEvents.endDate, range.end))
    }
  }

  if (categoryIds) {
    filters.push(inArray(calendarEvents.categoryId, categoryIds.split(',')))
  }

  if (decrypted.length === 0) {
    const query = getDb()
      .select()
      .from(calendarEvents)
      .where(and(...filters))

    if (!(startDate && endDate)) {
      query.orderBy(desc(calendarEvents.startDate)).limit(1000)
    }

    const results = await query

    if (startDate && endDate) {
      const grouped = groupByMonth(results)
      for (const [ym, monthEvents] of grouped) {
        await setCachedEvents(currentUser.id, ym, monthEvents)
      }
    }

    decrypted = results.map(decryptEvent)
  }

  const recurringRows = await getDb()
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, currentUser.id),
        or(isNotNull(calendarEvents.rrule), isNotNull(calendarEvents.seriesId)),
      ),
    )

  const windowStart =
    startDate && endDate
      ? fullMonthRange(startDate, endDate).start
      : new Date(Date.now() - DEFAULT_EXPANSION_WINDOW_MS)
  const windowEnd =
    startDate && endDate
      ? fullMonthRange(startDate, endDate).end
      : new Date(Date.now() + DEFAULT_EXPANSION_WINDOW_MS)

  const baseRows = dedupeById([
    ...decrypted,
    ...recurringRows.map(decryptEvent),
  ])
  const seriesIds = new Set(
    baseRows.filter((e) => isSeriesEvent({ rrule: e.rrule })).map((e) => e.id),
  )
  const rowsForExpand = baseRows.map((e) =>
    e.seriesId !== null && !seriesIds.has(e.seriesId)
      ? { ...e, seriesId: null }
      : e,
  )

  const expanded = expandRows(rowsForExpand as EventRow[], {
    windowStart,
    windowEnd,
  }).map((e) => (e.recurrenceId !== null ? { ...e, id: e.instanceId } : e))

  const allBaseEvents = [
    ...expanded,
    ...(await getSharedEvents(currentUser)),
  ] as Array<ReturnType<typeof decryptEvent> & { instanceId?: string }>

  const eventsWithInvites = await enrichEventsWithInvites(
    allBaseEvents,
    currentUser.id,
    currentUser.email,
  )

  if (categoryIds) {
    const ids = categoryIds.split(',')
    eventsWithInvites.splice(
      0,
      eventsWithInvites.length,
      ...eventsWithInvites.filter(
        (e) => e.categoryId && ids.includes(e.categoryId),
      ),
    )
  }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return NextResponse.json({
      events: eventsWithInvites.filter(
        (e) => e.startDate >= start && e.endDate <= end,
      ),
    })
  }

  return NextResponse.json({ events: eventsWithInvites })
}

export const POST = async function POST(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bodyResult = await request.json().catch(() => null)
  const parsedBody = z
    .object({})
    .passthrough()
    .and(recurringFieldsSchema)
    .and(eventSchema)
    .safeParse(bodyResult)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: firstZodMessage(parsedBody.error) },
      { status: 400 },
    )
  }
  const body = parsedBody.data as typeof parsedBody.data & {
    rrule?: string
    exdate?: string[]
    apply_to?: ApplyTo
    id?: string
  }

  const rawRrule =
    typeof body.rrule === 'string' && body.rrule.trim().length > 0
      ? body.rrule
      : null
  if (rawRrule !== null && !isValidRrule(rawRrule)) {
    return NextResponse.json({ error: 'Invalid rrule' }, { status: 400 })
  }
  if (body.exdate !== null && body.exdate !== undefined) {
    if (rawRrule === null) {
      return NextResponse.json(
        { error: 'exdate requires rrule' },
        { status: 400 },
      )
    }
    for (const stamp of body.exdate) {
      if (!isValidStamp(stamp)) {
        return NextResponse.json({ error: 'Invalid exdate' }, { status: 400 })
      }
    }
  }

  const id = body.id ?? crypto.randomUUID()
  const isUpdate = !!body.id
  const parsedId = isInstanceId(id) ? parseInstanceId(id) : null

  const submittedFields: Partial<EventRow> = {
    title: body.title,
    description: body.description ?? null,
    location: body.location ?? null,
    startDate: new Date(body.startDate),
    endDate: new Date(body.endDate),
    isAllDay: body.isAllDay ?? false,
    status: body.status ?? 'confirmed',
    color: body.color ?? null,
    categoryId: body.categoryId ?? null,
    participants: body.participants as unknown as string[] | undefined,
    notificationMinutes: body.notificationMinutes ?? null,
  }

  if (parsedId) {
    const [master] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, user.id),
        ),
      )
    if (
      !master ||
      !isSeriesEvent({
        rrule: master.rrule,
      })
    ) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = (await fetchOverrides(masterRow.id)).map((o) =>
      decryptEvent(o as typeof calendarEvents.$inferSelect),
    )
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const applyTo = body.apply_to ?? 'single'

    if (applyTo === 'all') {
      const set = {
        ...encryptMergedFields(masterRow.id, submittedFields),
        ...(body.rrule !== undefined ? { rrule: rawRrule } : {}),
        ...(body.exdate !== undefined ? { exdate: body.exdate } : {}),
        updatedAt: new Date(),
      }
      const [updated] = await getDb()
        .update(calendarEvents)
        .set(set)
        .where(
          and(
            eq(calendarEvents.id, masterRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
        .returning()
      await invalidateEventCache(
        user.id,
        masterRow.startDate.toISOString(),
        masterRow.endDate.toISOString(),
      )
      const [withInvites] = await enrichEventsWithInvites(
        [decryptEvent(updated)],
        user.id,
        user.email,
      )
      return NextResponse.json({ event: withInvites })
    }

    const now = new Date()
    const plan = planInstanceChange({
      master: masterRow,
      override,
      overrides,
      recurrenceId: parsedId.recurrenceId,
      applyTo,
      fields: submittedFields,
      now,
    })

    if (plan.split) {
      const newMaster = await applySplitPlan(user.id, plan, masterRow)
      if (!newMaster)
        return NextResponse.json(
          { error: 'Failed to split series' },
          { status: 500 },
        )
      return NextResponse.json({ event: newMaster })
    }

    if (plan.exdateToAdd) {
      await getDb()
        .update(calendarEvents)
        .set({
          exdate: [...(masterRow.exdate ?? []), plan.exdateToAdd],
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarEvents.id, masterRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
    }

    const upsert = plan.overrideUpsert!
    const encryptedOverride = encryptMergedFields(upsert.id, upsert.fields)
    let stored
    if (upsert.isNew) {
      ;[stored] = await getDb()
        .insert(calendarEvents)
        .values({
          id: upsert.id,
          userId: user.id,
          seriesId: upsert.seriesId,
          recurrenceId: upsert.recurrenceId,
          createdAt: upsert.fields.createdAt as Date,
          updatedAt: upsert.fields.updatedAt as Date,
          ...encryptedOverride,
        } as typeof calendarEvents.$inferInsert)
        .returning()
    } else {
      ;[stored] = await getDb()
        .update(calendarEvents)
        .set({ ...encryptedOverride, updatedAt: new Date() })
        .where(
          and(
            eq(calendarEvents.id, upsert.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
        .returning()
    }

    await invalidateEventCache(
      user.id,
      masterRow.startDate.toISOString(),
      masterRow.endDate.toISOString(),
    )

    const storedDecrypted = stored
      ? (decryptEvent(stored) as unknown as EventRow)
      : null
    const resolved = resolveInstance(
      masterRow,
      parsedId.recurrenceId,
      storedDecrypted ? [storedDecrypted, ...overrides] : overrides,
    )
    const [withInvites] = await enrichEventsWithInvites(
      [
        resolved
          ? { ...resolved, id, instanceId: id }
          : { ...masterRow, id, instanceId: id },
      ],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  const [old] = await getDb()
    .select({
      id: calendarEvents.id,
      startDate: calendarEvents.startDate,
      endDate: calendarEvents.endDate,
      userId: calendarEvents.userId,
    })
    .from(calendarEvents)
    .where(eq(calendarEvents.id, id))

  if (old && old.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (old) {
    await invalidateEventCache(
      user.id,
      old.startDate.toISOString(),
      old.endDate.toISOString(),
    )
  }

  const [fullOld] = isUpdate
    ? await getDb()
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.id, id))
    : [undefined]

  if (isUpdate && fullOld && fullOld.seriesId !== null) {
    const overrideRow = decryptEvent(fullOld) as unknown as EventRow
    const merged = mergeOverride<EventRow>(overrideRow, submittedFields)
    const [updated] = await getDb()
      .update(calendarEvents)
      .set({
        ...encryptMergedFields(
          overrideRow.id,
          merged as unknown as Record<string, unknown>,
        ),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, overrideRow.id),
          eq(calendarEvents.userId, user.id),
        ),
      )
      .returning()
    if (overrideRow.seriesId !== null) {
      await invalidateMasterCache(user.id, overrideRow.seriesId)
    }
    const [withInvites] = await enrichEventsWithInvites(
      [decryptEvent(updated)],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  if (isUpdate && fullOld && isSeriesEvent({ rrule: fullOld.rrule })) {
    const seriesRow = decryptEvent(fullOld) as unknown as EventRow
    const applyTo = body.apply_to ?? 'all'

    if (applyTo === 'all') {
      const set = {
        ...encryptMergedFields(seriesRow.id, submittedFields),
        ...(body.rrule !== undefined ? { rrule: rawRrule } : {}),
        ...(body.exdate !== undefined ? { exdate: body.exdate } : {}),
        updatedAt: new Date(),
      }
      const [updated] = await getDb()
        .update(calendarEvents)
        .set(set)
        .where(
          and(
            eq(calendarEvents.id, seriesRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
        .returning()
      const [withInvites] = await enrichEventsWithInvites(
        [decryptEvent(updated)],
        user.id,
        user.email,
      )
      return NextResponse.json({ event: withInvites })
    }

    const recurrenceId = firstStampOfSeries(seriesRow)
    const overrides = (await fetchOverrides(seriesRow.id)).map((o) =>
      decryptEvent(o as typeof calendarEvents.$inferSelect),
    )
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo,
      fields: submittedFields,
      now: new Date(),
    })

    if (plan.split) {
      const newMaster = await applySplitPlan(user.id, plan, seriesRow)
      if (!newMaster)
        return NextResponse.json(
          { error: 'Failed to split series' },
          { status: 500 },
        )
      return NextResponse.json({ event: newMaster })
    }

    if (plan.exdateToAdd) {
      await getDb()
        .update(calendarEvents)
        .set({
          exdate: [...(seriesRow.exdate ?? []), plan.exdateToAdd],
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(calendarEvents.id, seriesRow.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
    }

    const upsert = plan.overrideUpsert!
    const encryptedOverride = encryptMergedFields(upsert.id, upsert.fields)
    let stored
    if (upsert.isNew) {
      ;[stored] = await getDb()
        .insert(calendarEvents)
        .values({
          id: upsert.id,
          userId: user.id,
          seriesId: upsert.seriesId,
          recurrenceId: upsert.recurrenceId,
          createdAt: upsert.fields.createdAt as Date,
          updatedAt: upsert.fields.updatedAt as Date,
          ...encryptedOverride,
        } as typeof calendarEvents.$inferInsert)
        .returning()
    } else {
      ;[stored] = await getDb()
        .update(calendarEvents)
        .set({ ...encryptedOverride, updatedAt: new Date() })
        .where(
          and(
            eq(calendarEvents.id, upsert.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
        .returning()
    }

    await invalidateEventCache(
      user.id,
      seriesRow.startDate.toISOString(),
      seriesRow.endDate.toISOString(),
    )

    const storedDecrypted = stored
      ? (decryptEvent(stored) as unknown as EventRow)
      : null
    const resolved = resolveInstance(
      seriesRow,
      recurrenceId,
      storedDecrypted ? [storedDecrypted, ...overrides] : overrides,
    )
    const [withInvites] = await enrichEventsWithInvites(
      [
        resolved
          ? { ...resolved, id, instanceId: id }
          : { ...seriesRow, id, instanceId: id },
      ],
      user.id,
      user.email,
    )
    return NextResponse.json({ event: withInvites })
  }

  const [event] = await getDb()
    .insert(calendarEvents)
    .values({
      id,
      userId: user.id,
      title: encryptField(id, body.title) ?? '',
      description: encryptField(id, body.description),
      location: encryptField(id, body.location),
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      isAllDay: body.isAllDay ?? false,
      status: body.status ?? 'confirmed',
      color: body.color ?? null,
      categoryId: body.categoryId ?? null,
      participants: encryptJsonField(id, body.participants),
      notificationMinutes: body.notificationMinutes ?? null,
      rrule: rawRrule,
      exdate: body.exdate ?? null,
    })
    .onConflictDoUpdate({
      target: calendarEvents.id,
      set: {
        title: encryptField(id, body.title) ?? '',
        description: encryptField(id, body.description),
        location: encryptField(id, body.location),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        isAllDay: body.isAllDay ?? false,
        status: body.status ?? 'confirmed',
        color: body.color ?? null,
        categoryId: body.categoryId ?? null,
        participants: encryptJsonField(id, body.participants),
        notificationMinutes: body.notificationMinutes ?? null,
        rrule: rawRrule,
        exdate: body.exdate ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()

  await invalidateEventCache(user.id, body.startDate, body.endDate)

  return NextResponse.json({ event: decryptEvent(event) })
}

export const DELETE = async function DELETE(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (body === null || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { id } = body as { id?: string }
  const apply_to = body.apply_to as ApplyTo | null | undefined
  if (!id)
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  if (
    apply_to !== null &&
    apply_to !== undefined &&
    !APPLY_TO_VALUES.has(apply_to)
  ) {
    return NextResponse.json({ error: 'Invalid apply_to' }, { status: 400 })
  }

  const parsedId = isInstanceId(id) ? parseInstanceId(id) : null

  if (parsedId) {
    const [master] = await getDb()
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, parsedId.seriesId),
          eq(calendarEvents.userId, user.id),
        ),
      )
    if (
      !master ||
      !isSeriesEvent({
        rrule: master.rrule,
      })
    ) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const masterRow = decryptEvent(master) as unknown as EventRow
    const overrides = await fetchOverrides(masterRow.id)
    const override =
      overrides.find((o) => o.recurrenceId === parsedId.recurrenceId) ?? null
    const applyTo = apply_to ?? 'single'

    if (applyTo === 'all') {
      await deleteRow(user.id, masterRow)
      return NextResponse.json({ success: true })
    }

    if (applyTo === 'single') {
      if (override) {
        await deleteRow(user.id, override)
        await getDb()
          .update(calendarEvents)
          .set({
            exdate: [
              ...new Set([...(masterRow.exdate ?? []), parsedId.recurrenceId]),
            ],
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
        await invalidateEventCache(
          user.id,
          masterRow.startDate.toISOString(),
          masterRow.endDate.toISOString(),
        )
      } else {
        await getDb()
          .update(calendarEvents)
          .set({
            exdate: [
              ...new Set([...(masterRow.exdate ?? []), parsedId.recurrenceId]),
            ],
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(calendarEvents.id, masterRow.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
        await invalidateEventCache(
          user.id,
          masterRow.startDate.toISOString(),
          masterRow.endDate.toISOString(),
        )
      }
      return NextResponse.json({ success: true })
    }

    const plan = planInstanceChange({
      master: masterRow,
      override,
      overrides,
      recurrenceId: parsedId.recurrenceId,
      applyTo: 'following',
      fields: {},
      now: new Date(),
    })
    const newMaster = await applySplitPlan(user.id, plan, masterRow)
    if (newMaster) {
      await getDb()
        .delete(calendarEvents)
        .where(
          and(
            eq(calendarEvents.id, newMaster.id),
            eq(calendarEvents.userId, user.id),
          ),
        )
    }
    return NextResponse.json({ success: true })
  }

  const [old] = await getDb()
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id)))

  if (!old)
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  if (old.seriesId !== null) {
    await deleteRow(user.id, old as unknown as EventRow)
    await invalidateMasterCache(user.id, old.seriesId)
    return NextResponse.json({ success: true })
  }

  if (isSeriesEvent({ rrule: old.rrule })) {
    const seriesRow = decryptEvent(old) as unknown as EventRow
    const applyTo = apply_to ?? 'all'

    if (applyTo === 'all') {
      await deleteRow(user.id, seriesRow)
      return NextResponse.json({ success: true })
    }

    const recurrenceId = firstStampOfSeries(seriesRow)
    const overrides = await fetchOverrides(seriesRow.id)
    const override =
      overrides.find((o) => o.recurrenceId === recurrenceId) ?? null
    const plan = planInstanceChange({
      master: seriesRow,
      override,
      overrides,
      recurrenceId,
      applyTo,
      fields: {},
      now: new Date(),
    })

    if (plan.split) {
      const newMaster = await applySplitPlan(user.id, plan, seriesRow)
      if (newMaster) {
        await getDb()
          .delete(calendarEvents)
          .where(
            and(
              eq(calendarEvents.id, newMaster.id),
              eq(calendarEvents.userId, user.id),
            ),
          )
      }
      return NextResponse.json({ success: true })
    }

    if (plan.deleteOverrideId) {
      await deleteRow(user.id, override!)
      return NextResponse.json({ success: true })
    }

    await getDb()
      .update(calendarEvents)
      .set({
        exdate: [...new Set([...(seriesRow.exdate ?? []), recurrenceId])],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, seriesRow.id),
          eq(calendarEvents.userId, user.id),
        ),
      )
    await invalidateEventCache(
      user.id,
      seriesRow.startDate.toISOString(),
      seriesRow.endDate.toISOString(),
    )
    return NextResponse.json({ success: true })
  }

  await deleteRow(user.id, old as unknown as EventRow)
  return NextResponse.json({ success: true })
}
