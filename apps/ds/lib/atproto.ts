export async function resolveHandleToDidAndPds(handle: string) {
  const normalized = handle.replace(/^@/, '').trim().toLowerCase()
  if (!normalized) {
    throw new Error('invalid_handle')
  }

  const didRes = await fetch(
    `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(normalized)}`,
    { cache: 'no-store' },
  )

  if (!didRes.ok) {
    throw new Error('handle_resolution_failed')
  }

  const didJson = (await didRes.json()) as { did?: string }
  if (!didJson.did) {
    throw new Error('did_not_found')
  }

  const plcRes = await fetch(
    `https://plc.directory/${encodeURIComponent(didJson.did)}`,
    { cache: 'no-store' },
  )

  if (!plcRes.ok) {
    throw new Error('did_document_fetch_failed')
  }

  const didDoc = (await plcRes.json()) as {
    service?: Array<{ type?: string; serviceEndpoint?: string }>
  }

  const pds = didDoc.service?.find(
    (service) => service.type === 'AtprotoPersonalDataServer',
  )?.serviceEndpoint

  if (!pds) {
    throw new Error('pds_not_found')
  }

  return {
    handle: normalized,
    did: didJson.did,
    pds,
  }
}
