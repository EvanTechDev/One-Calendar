// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildReminderEmail } from '@/lib/email/reminder-template'

describe('reminder email', () => {
  it('puts distinct event information and multiline notes before the calendar action', async () => {
    const html = await buildReminderEmail({
      title: 'Review',
      timeRange: 'Oct 6, 09:00 – 10:00 EDT',
      location: 'Room 5',
      description: 'Bring notes\nReview outcomes',
      appUrl: 'https://calendar.example/app',
    })
    const action = html.indexOf('Open Calendar')
    for (const text of [
      'Oct 6, 09:00 – 10:00 EDT',
      'Room 5',
      'About this event',
      'Bring notes\nReview outcomes',
    ]) {
      expect(html).toContain(text)
      expect(html.indexOf(text)).toBeLessThan(action)
    }
    expect(html).toContain('href="https://calendar.example/app"')
    expect(html).toContain('All rights reserved.')
    expect(html).not.toContain('Respond to invitation')
  })

  it('omits empty details and escapes event text', async () => {
    const html = await buildReminderEmail({
      title: 'A < B',
      timeRange: 'Tomorrow',
      location: ' ',
      description: '\n',
      appUrl: 'https://calendar.example/app',
    })
    expect(html).toContain('A &lt; B')
    expect(html).not.toContain('>Where<')
    expect(html).not.toContain('About this event')
  })
})
