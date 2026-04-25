import { PrismaClient } from '@/lib/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.POSTGRES_URL
  if (!databaseUrl) {
    throw new Error('Missing POSTGRES_URL environment variable')
  }

  const useSsl =
    process.env.POSTGRES_SSL === 'true' ||
    process.env.NODE_ENV === 'production' ||
    databaseUrl.includes('sslmode=require') ||
    databaseUrl.includes('ssl=true')

  const rejectUnauthorized = process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === 'true'

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient()
    const value = Reflect.get(client as object, property)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
