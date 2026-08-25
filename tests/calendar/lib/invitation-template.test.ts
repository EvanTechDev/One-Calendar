import { describe, it, expect, vi } from 'vitest'

// The template renders through react-email; capture the props it is given
// rather than asserting on rendered HTML, which is what the calling code
// actually decides.
const rendered: Record<string, unknown>[] = []
vi.mock('@/lib/auth/email-template', () => ({
  renderAuthEmailTemplate: async (props: Record<string, unknown>) => {
    rendered.push(props)
    return '<html></html>'
  },
}))

const { buildInvitationEmail } = await import('@/lib/email/invitation-template')

const base = {
  title: 'Q3 budget review',
  timeRange: 'Tue, 26 Aug, 14:00 – 15:00',
  inviterName: 'Ada',
  inviteLink: 'https://cal.example.com/invite/tok123',
}

async function build(params: Parameters<typeof buildInvitationEmail>[0]) {
  rendered.length = 0
  await buildInvitationEmail(params)
  return rendered[0]!
}

describe('invitation email', () => {
  it('leads with the RSVP page when the event has no meeting', async () => {
    const props = await build(base)
    expect(props.actionLabel).toBe('View Invitation')
    expect(props.actionUrl).toBe(base.inviteLink)
    expect(props.secondaryActionLabel).toBeUndefined()
  })

  it('leads with the meeting when the event has one', async () => {
    const props = await build({
      ...base,
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    expect(props.actionLabel).toBe('Join with Zentra Meet')
    expect(props.actionUrl).toBe('https://meet.example.com/ab3k-x9q2')
  })

  it('keeps the RSVP page reachable as a secondary action', async () => {
    const props = await build({
      ...base,
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    expect(props.secondaryActionLabel).toBe('View invitation and RSVP')
    expect(props.secondaryActionUrl).toBe(base.inviteLink)
  })

  it('spells the join link out as text for plain-text clients', async () => {
    const props = await build({
      ...base,
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    expect(props.secondary).toContain(
      'Join: https://meet.example.com/ab3k-x9q2',
    )
  })

  it('still lists when, where, and notes alongside the join link', async () => {
    const props = await build({
      ...base,
      location: 'Room 3',
      description: 'Bring the deck',
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    const secondary = props.secondary as string
    expect(secondary).toContain('When: Tue, 26 Aug, 14:00 – 15:00')
    expect(secondary).toContain('Where: Room 3')
    expect(secondary).toContain('Notes: Bring the deck')
  })

  it('omits the join line entirely when there is no meeting', async () => {
    const props = await build({ ...base, location: 'Room 3' })
    expect(props.secondary as string).not.toContain('Join:')
  })
})
