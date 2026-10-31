/**
 * Composes absolute Zentra Meet links. Room codes are root-path
 * (`<meet-origin>/<code>`, ADR-0019), and the origin differs per
 * deployment because meet is its own app.
 */
export function meetingUrl(meetingId: string): string {
  const origin = process.env.NEXT_PUBLIC_MEET_ORIGIN ?? ''
  return `${origin.replace(/\/$/, '')}/${meetingId}`
}
