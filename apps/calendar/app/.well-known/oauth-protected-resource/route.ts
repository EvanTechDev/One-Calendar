import { auth } from '@/features/auth'

export async function GET(request: Request) {
  return auth.handler(request)
}
