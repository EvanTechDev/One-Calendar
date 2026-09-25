import { describe, expect, it } from 'vitest'
import { MCP_ACCESS_TOKEN_TTL_SECONDS } from '@/lib/mcp/oauth-config'

describe('MCP OAuth configuration', () => {
  it('keeps access tokens valid for 14 days', () => {
    expect(MCP_ACCESS_TOKEN_TTL_SECONDS).toBe(14 * 24 * 60 * 60)
  })
})
