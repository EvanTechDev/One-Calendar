import { NextRequest, NextResponse } from 'next/server'
import { getAuthedUser } from '@/lib/api-helpers'
import { searchEventPage } from '@/lib/keyword-search'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const query = params.get('q')?.trim() ?? ''
  const cursor = params.get('cursor')
  const categories = params.getAll('category')
  if (
    !query ||
    query.length > 200 ||
    (cursor && cursor.length > 128) ||
    categories.length > 100
  ) {
    return NextResponse.json({ error: 'Invalid search' }, { status: 400 })
  }
  try {
    const result = await searchEventPage(
      user,
      query,
      cursor,
      categories,
      request.signal,
    )
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('[events/search]', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
