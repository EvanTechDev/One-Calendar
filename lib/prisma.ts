import { PrismaClient } from '@/lib/generated/prisma/client'
import { APP_CONFIG } from '@/lib/config'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const client = new PrismaClient({
    ...(APP_CONFIG.prisma.enableAccelerate
      ? { accelerateUrl: process.env.POSTGRES_URL }
      : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  if (!APP_CONFIG.prisma.enableAccelerate) return client

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withAccelerate } = require('@prisma/extension-accelerate') as {
    withAccelerate: () => Parameters<PrismaClient['$extends']>[0]
  }

  return client.$extends(withAccelerate()) as PrismaClient
}

export function getPrismaClient() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
  }
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient()
    return Reflect.get(client as unknown as object, prop, receiver)
  },
})
