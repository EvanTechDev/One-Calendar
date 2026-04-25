import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'schema.prisma',
  datasource: {
    url: process.env.POSTGRES_URL!,
    directUrl: process.env.POSTGRES_URL_NON_POOLING!,
  },
})
