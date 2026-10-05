import { expect, it } from 'vitest'
import { betterAuth } from 'better-auth'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createDrizzleAdapter } from '@zntr/auth/adapter'
import { authSchema } from '@zntr/auth/schema'

it('retains the Drizzle schema check across the real adapter and auth core', async () => {
  // Drizzle validates the declared schema; no database connection is needed.
  const auth = betterAuth({
    baseURL: 'https://calendar.example',
    secret: 'test-secret-long-enough-for-schema-validation',
    database: createDrizzleAdapter(drizzle.mock({ schema: authSchema })),
    emailAndPassword: { enabled: true },
  })
  const context = await auth.$context

  // Different peer-resolution copies of @better-auth/core each have their own
  // schema-check registry, silently losing the check registered by the adapter.
  expect(context.checkSchema).toBeTypeOf('function')
  await context.checkSchema!()
})
