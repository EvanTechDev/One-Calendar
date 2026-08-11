interface InvitationEmailParams {
  title: string
  startDate: string
  endDate: string
  isAllDay: boolean
  inviterName: string
  inviteLink: string
  description?: string
  location?: string
}

export function buildInvitationEmail(params: InvitationEmailParams): string {
  const {
    title,
    startDate,
    endDate,
    isAllDay,
    inviterName,
    inviteLink,
    description,
    location,
  } = params

  const timeStr = isAllDay
    ? `${startDate} (All day)`
    : `${startDate} – ${endDate}`

  const descriptionHtml = description
    ? `<p style="margin: 0 0 12px; color: #374151; white-space: pre-wrap;">${escapeHtml(description)}</p>`
    : ''

  const locationHtml = location
    ? `<p style="margin: 0 0 12px; color: #374151;"><strong>Location:</strong> ${escapeHtml(location)}</p>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation: ${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 0;">
              <h1 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">${escapeHtml(title)}</h1>
              <p style="margin: 0 0 16px; font-size: 14px; color: #6b7280;">${escapeHtml(inviterName)} invited you to this event</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px;">
              <div style="border-left: 3px solid #3b82f6; padding-left: 16px; margin-bottom: 16px;">
                <p style="margin: 0 0 4px; font-size: 14px; color: #374151;"><strong>When</strong></p>
                <p style="margin: 0; font-size: 14px; color: #6b7280;">${escapeHtml(timeStr)}</p>
              </div>
              ${locationHtml}
              ${descriptionHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px;" align="center">
              <a href="${escapeHtml(inviteLink)}" style="display: inline-block; padding: 12px 32px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Invitation</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
