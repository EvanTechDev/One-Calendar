// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dns = vi.hoisted(() => ({
  addresses: null as null | Array<{ address: string; family: 4 | 6 }>,
}))

vi.mock('node:dns/promises', () => ({
  lookup: async (hostname: string) =>
    dns.addresses ?? [
      {
        address: hostname,
        family: hostname.includes(':') ? (6 as const) : (4 as const),
      },
    ],
}))

import { fetchCimdResource } from '@zntr/auth/cimd-fetch'

beforeEach(() => {
  dns.addresses = null
})

describe('CIMD metadata transport', () => {
  it('requires HTTPS before performing DNS or network I/O', async () => {
    await expect(
      fetchCimdResource('http://example.com/client.json'),
    ).rejects.toThrow(/requires HTTPS/)
  })

  it('allows only GET and HEAD', async () => {
    await expect(
      fetchCimdResource('https://example.com/client.json', { method: 'POST' }),
    ).rejects.toThrow(/only GET and HEAD/)
  })

  it('rejects loopback metadata targets before connecting', async () => {
    await expect(
      fetchCimdResource('https://127.0.0.1/client.json'),
    ).rejects.toThrow(/public IPs/)
  })

  it('rejects a hostname when any DNS answer is non-public', async () => {
    dns.addresses = [
      { address: '8.8.8.8', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]

    await expect(
      fetchCimdResource('https://metadata.example/client.json'),
    ).rejects.toThrow(/resolve only to public IPs/)
  })
})
