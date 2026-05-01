import { PrismaClient } from '@/lib/generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { APP_CONFIG } from '@/lib/config'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrismaClient() {
  const client = new PrismaClient({
    ...(APP_CONFIG.prisma.enableAccelerate ? { accelerateUrl: process.env.POSTGRES_URL } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
  return APP_CONFIG.prisma.enableAccelerate ? client.$extends(withAccelerate()) : client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
