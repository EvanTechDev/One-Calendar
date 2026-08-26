import { describe, it, expect } from 'vitest'
import { buildPortalDiagnostics } from '../../packages/auth/src/diagnostics'

/**
 * The portal's diagnostic report.
 *
 * It exists because a misconfigured client presents as a mysteriously anonymous
 * user with nothing in any log (plan 026, story 26) — we have lost time to
 * exactly that twice with the shared-cookie arrangement.
 *
 * Which makes it a hazard: a report that answers "is my configuration right"
 * necessarily reads the configuration. So the property under test is not only
 * "reports the right things" but "cannot be turned into a secret oracle".
 */
const FULL = {
  secret: 'a-real-secret-value-nobody-should-see',
  baseURL: 'https://auth.example.com',
  clientOrigins: ['https://cal.example.com', 'https://meet.example.com'],
  databaseUrl: 'postgres://user:hunter2@db.example.com:5432/postgres',
  sentinelApiKey: 'sentinel-key-abc123',
}

describe('portal diagnostics', () => {
  it('reports whether each required value is present', () => {
    const report = buildPortalDiagnostics(FULL)
    expect(report.secret).toBe('set')
    expect(report.baseURL).toBe('https://auth.example.com')
    expect(report.database).toBe('set')
  })

  it('never includes the secret, in any form', () => {
    const serialised = JSON.stringify(buildPortalDiagnostics(FULL))
    // Asserted against the serialised report rather than a named field: a future
    // field could carry it by accident, and this catches that.
    expect(serialised).not.toContain(FULL.secret)
    expect(serialised).not.toContain('a-real-secret')
  })

  it('never includes a database password', () => {
    const serialised = JSON.stringify(buildPortalDiagnostics(FULL))
    expect(serialised).not.toContain('hunter2')
    expect(serialised).not.toContain(FULL.databaseUrl)
  })

  it('never includes an API key', () => {
    const serialised = JSON.stringify(buildPortalDiagnostics(FULL))
    expect(serialised).not.toContain(FULL.sentinelApiKey)
  })

  it('does not leak a secret through its length', () => {
    // Reporting a length narrows a brute force and tells an attacker which
    // secret they are looking at. "set" is the whole useful signal.
    const short = buildPortalDiagnostics({ ...FULL, secret: 'x' })
    const long = buildPortalDiagnostics({
      ...FULL,
      secret: 'x'.repeat(200),
    })
    expect(JSON.stringify(short)).toBe(JSON.stringify(long))
  })

  it('says a value is missing when it is', () => {
    // The actual diagnostic use: the report has to be able to say "this is why
    // your users look anonymous".
    const report = buildPortalDiagnostics({
      ...FULL,
      secret: undefined,
      baseURL: undefined,
      databaseUrl: undefined,
    })
    expect(report.secret).toBe('missing')
    expect(report.baseURL).toBe('missing')
    expect(report.database).toBe('missing')
  })

  it('lists the client origins, which are public by nature', () => {
    // A redirect URI is visible in every authorization request, so listing it
    // reveals nothing — and it is the single most common thing to get wrong.
    const report = buildPortalDiagnostics(FULL)
    expect(report.clientOrigins).toEqual([
      'https://cal.example.com',
      'https://meet.example.com',
    ])
  })

  it('warns when no client origin is configured', () => {
    // With none, every authorization request fails the CSRF check and every
    // client looks broken for no visible reason.
    const report = buildPortalDiagnostics({ ...FULL, clientOrigins: [] })
    expect(report.warnings).toContain('no client origins configured')
  })

  it('warns when a client origin is not https in production', () => {
    const report = buildPortalDiagnostics({
      ...FULL,
      clientOrigins: ['http://cal.example.com'],
      isProduction: true,
    })
    expect(report.warnings.join(' ')).toMatch(/https/i)
  })

  it('does not warn about http on localhost', () => {
    // Local development is the one legitimate case, and a warning that always
    // fires is a warning nobody reads.
    const report = buildPortalDiagnostics({
      ...FULL,
      clientOrigins: ['http://localhost:3000'],
      isProduction: false,
    })
    expect(report.warnings.join(' ')).not.toMatch(/https/i)
  })

  it('reports which paths are reachable, so a 404 can be explained', () => {
    const report = buildPortalDiagnostics(FULL)
    expect(report.exposedPaths).toContain('/oauth2/token')
    // And confirms the admin family is withheld — the question someone will ask
    // when a seeding script 404s.
    expect(report.exposedPaths.join(' ')).not.toContain('/admin/')
  })
})
