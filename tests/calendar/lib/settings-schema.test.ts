import { describe, expect, it } from 'vitest'
import { settingsPatchSchema, settingsSchema } from '@/lib/validation'
import { CALENDAR_COLOR_OPTIONS } from '@zntr/calendar-ui/lib/calendar-colors'

/**
 * The settings blob is merged, not replaced — a PUT carries only what changed.
 * So these assertions are about what may be *stored*, since anything accepted
 * here survives into the JSON column and every reader trusts it.
 *
 * Both writers are covered by the same schema: PUT /api/settings and
 * POST /api/account/onboarding-complete.
 */
describe('settingsSchema', () => {
  it('accepts a partial patch, since that is how it is written', () => {
    expect(settingsSchema.parse({})).toEqual({})
    expect(settingsSchema.parse({ theme: 'dark' })).toEqual({ theme: 'dark' })
  })

  it('drops an unknown key rather than storing it', () => {
    // Not `strict()` on purpose: a newer client may know a setting this build
    // does not, and a 400 there would read as a broken app.
    expect(settingsPatchSchema.parse({ theme: 'dark', hacked: 'x' })).toEqual({
      theme: 'dark',
    })
  })

  it('rejects a value of the wrong type instead of coercing it', () => {
    expect(settingsPatchSchema.safeParse({ theme: 'neon' }).success).toBe(false)
    expect(
      settingsPatchSchema.safeParse({ enableShortcuts: 'yes' }).success,
    ).toBe(false)
    expect(settingsPatchSchema.safeParse({ firstDayOfWeek: 9 }).success).toBe(
      false,
    )
  })

  it('accepts firstDayOfWeek as a number, from the settings dialog', () => {
    expect(settingsPatchSchema.parse({ firstDayOfWeek: 1 })).toEqual({
      firstDayOfWeek: 1,
    })
  })

  it('accepts firstDayOfWeek as a numeric string, from the onboarding dialog', () => {
    // The onboarding dialog keeps its answers in a Record<string, string>, so
    // this is '0' | '1' | '6' on the wire.
    expect(settingsPatchSchema.parse({ firstDayOfWeek: '6' })).toEqual({
      firstDayOfWeek: 6,
    })
    expect(settingsPatchSchema.parse({ firstDayOfWeek: '0' })).toEqual({
      firstDayOfWeek: 0,
    })
  })

  it('rejects a non-numeric firstDayOfWeek rather than storing NaN', () => {
    // The route used to call Number() on this unconditionally, so 'abc'
    // became NaN and JSON.stringify wrote it as null — a stored setting that
    // no reader could interpret.
    expect(
      settingsPatchSchema.safeParse({ firstDayOfWeek: 'abc' }).success,
    ).toBe(false)
  })

  it('only accepts a calendar colour the picker can actually produce', () => {
    for (const option of CALENDAR_COLOR_OPTIONS) {
      expect(
        settingsPatchSchema.safeParse({ calendarColor: option.value }).success,
      ).toBe(true)
    }
    // This value reaches documentElement.dataset.calendarColor via
    // applyCalendarColor, so it is a class-name sink.
    expect(
      settingsPatchSchema.safeParse({ calendarColor: '" onload="x' }).success,
    ).toBe(false)
  })

  it('keeps onboardingCompleted, which the interface used to omit', () => {
    // It is the one key written by a route and read by app/page.tsx, and it
    // was never on the SettingsData type.
    expect(settingsPatchSchema.parse({ onboardingCompleted: true })).toEqual({
      onboardingCompleted: true,
    })
  })

  it('survives a whole onboarding submission', () => {
    // The exact shape welcome-dialog.tsx posts: five keys, all strings.
    expect(
      settingsPatchSchema.parse({
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        firstDayOfWeek: '1',
        defaultView: 'four-day',
        timeFormat: '24h',
      }),
    ).toEqual({
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      firstDayOfWeek: 1,
      defaultView: 'four-day',
      timeFormat: '24h',
    })
  })

  it('rejects a body that is not an object at all', () => {
    expect(settingsPatchSchema.safeParse(null).success).toBe(false)
    expect(settingsPatchSchema.safeParse('theme=dark').success).toBe(false)
    expect(settingsPatchSchema.safeParse([1, 2]).success).toBe(false)
  })
})
