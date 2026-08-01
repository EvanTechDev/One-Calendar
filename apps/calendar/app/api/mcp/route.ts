import { handleMcpRequest } from '@/lib/mcp/handler'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  return handleMcpRequest(request)
}

export async function GET(request: Request) {
  return handleMcpRequest(request)
}
