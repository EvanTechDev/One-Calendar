await import('../../../support/dom')
import { describe, expect, it } from 'bun:test'
const { MCP_ACCESS_TOKEN_TTL_SECONDS } =
  await import('@/features/mcp/oauth-config')

describe('MCP OAuth configuration', () => {
  it('keeps access tokens valid for 14 days', () => {
    expect(MCP_ACCESS_TOKEN_TTL_SECONDS).toBe(14 * 24 * 60 * 60)
  })
})
