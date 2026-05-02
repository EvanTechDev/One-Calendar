import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

type ClerkRow = {
  id: string
  email_address: string
  first_name?: string
  last_name?: string
  image_url?: string
  created_at?: string
  updated_at?: string
  email_address_verified?: string
  password_digest?: string
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) throw new Error('Usage: bun scripts/import-clerk-users.ts <path-to-clerk-users.csv>')

  const abs = path.resolve(process.cwd(), csvPath)
  const raw = fs.readFileSync(abs, 'utf8')
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as ClerkRow[]

  for (const row of rows) {
    const email = row.email_address?.trim().toLowerCase()
    if (!email) continue
    const id = row.id || randomUUID()
    const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || email
    const createdAt = row.created_at ? new Date(row.created_at) : new Date()
    const updatedAt = row.updated_at ? new Date(row.updated_at) : createdAt
    const emailVerified = row.email_address_verified === 'true'

    await prisma.user.upsert({
      where: { email },
      update: { name, image: row.image_url || null, emailVerified, updatedAt },
      create: { id, email, name, image: row.image_url || null, emailVerified, createdAt, updatedAt },
    })

    if (row.password_digest) {
      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (!existingUser) continue
      await prisma.account.upsert({
        where: { providerId_accountId: { providerId: 'credential', accountId: email } },
        update: { password: row.password_digest, userId: existingUser.id, updatedAt: new Date() },
        create: {
          id: randomUUID(),
          providerId: 'credential',
          accountId: email,
          userId: existingUser.id,
          password: row.password_digest,
          createdAt,
          updatedAt,
        },
      })
    }
  }

  console.log(`Imported ${rows.length} rows from Clerk CSV`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
