// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { fetchCimdResource } from '@zntr/auth/cimd-fetch'

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
})
