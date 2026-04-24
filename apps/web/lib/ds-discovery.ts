import { getRecord, resolveHandle } from '@/lib/atproto'

const DS_COLLECTION = 'app.onecalendar.ds'

export async function resolveDsForHandle(handle: string) {
  const normalized = handle.replace(/^@/, '').trim().toLowerCase()
  if (!normalized) {
    throw new Error('invalid_handle')
  }

  const resolved = await resolveHandle(normalized)
  const record = await getRecord({
    pds: resolved.pds,
    repo: resolved.did,
    collection: DS_COLLECTION,
    rkey: 'self',
  })

  const dsUrl =
    typeof record.value?.dsUrl === 'string'
      ? record.value.dsUrl
      : typeof record.value?.url === 'string'
        ? record.value.url
        : null

  if (!dsUrl) {
    throw new Error('ds_record_not_found')
  }

  return {
    handle: normalized,
    did: resolved.did,
    pds: resolved.pds,
    dsUrl: dsUrl.replace(/\/$/, ''),
  }
}
