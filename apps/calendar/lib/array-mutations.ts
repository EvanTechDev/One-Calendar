export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  const next = [...list]
  if (idx >= 0) next[idx] = item
  else next.push(item)
  return next
}

export function upsertBy<T>(
  list: T[],
  item: T,
  matches: (existing: T) => boolean,
): T[] {
  const next = [...list]
  const idx = next.findIndex(matches)
  if (idx >= 0) next[idx] = item
  else next.unshift(item)
  return next
}

export function removeById<T extends { id: string }>(
  list: T[],
  id: string,
): T[] {
  return list.filter((x) => x.id !== id)
}
