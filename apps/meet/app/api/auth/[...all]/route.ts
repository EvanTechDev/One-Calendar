import { toNextJsHandler } from '@zntr/auth'
import { getAuth } from '@/lib/auth'
import type { NextRequest } from 'next/server'

function handlers() {
  return toNextJsHandler(getAuth())
}

export async function GET(request: NextRequest) {
  return handlers().GET(request)
}

export async function POST(request: NextRequest) {
  return handlers().POST(request)
}
