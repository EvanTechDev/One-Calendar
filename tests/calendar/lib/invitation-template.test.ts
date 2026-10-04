// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildInvitationEmail } from '@/lib/email/invitation-template'

const base = {
  title: 'Q3 budget review',
  timeRange: 'Tue, 26 Aug, 14:00 – 15:00',
  inviterName: 'Ada',
  inviteLink: 'https://cal.example.com/invite/tok123',
}

describe('invitation email', () => {
  it('lets the recipient respond to an invitation without a meeting', async () => {
    const html = await buildInvitationEmail(base)
    expect(html).toContain(`href="${base.inviteLink}"`)
    expect(html).toContain('Respond to invitation')
    expect(html).not.toContain('Join with Zentra Meet')
  })

  it('keeps both RSVP and the durable meeting link reachable', async () => {
    const html = await buildInvitationEmail({
      ...base,
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    expect(html).toContain(`href="${base.inviteLink}"`)
    expect(html).toContain('Respond to invitation')
    expect(html).toContain('href="https://meet.example.com/ab3k-x9q2"')
    expect(html).toContain('Join with Zentra Meet')
  })

  it('presents the event details before asking for a response', async () => {
    const html = await buildInvitationEmail({
      ...base,
      location: 'Room 3',
      description: 'Bring the deck\nReview last quarter',
    })
    const action = html.indexOf('Respond to invitation')
    for (const text of [
      base.timeRange,
      'Room 3',
      'Bring the deck\nReview last quarter',
    ]) {
      expect(html).toContain(text)
      expect(html.indexOf(text)).toBeLessThan(action)
    }
  })

  it('also spells out the meeting URL so it can be copied', async () => {
    const html = await buildInvitationEmail({
      ...base,
      meetingUrl: 'https://meet.example.com/ab3k-x9q2',
    })
    expect(html.replace(/<[^>]*>/g, '')).toContain(
      'https://meet.example.com/ab3k-x9q2',
    )
  })

  it('escapes user-supplied content in the structured information', async () => {
    const html = await buildInvitationEmail({
      ...base,
      location: '<img src=x onerror=alert(1)>',
      description: 'Budget < 500 & bring notes',
    })
    expect(html).toContain('&lt;img')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('Budget &lt; 500 &amp; bring notes')
  })

  it('omits empty optional information', async () => {
    const html = await buildInvitationEmail({
      ...base,
      location: '  ',
      description: '\n',
    })
    expect(html).not.toContain('Video call')
    expect(html).not.toContain('About this event')
    expect(html).not.toContain('>Where<')
  })
})
