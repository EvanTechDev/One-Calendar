import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('migration logic', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('migrates settings from localStorage to API', async () => {
    localStorage.setItem('preferred-language', 'zh')
    localStorage.setItem('first-day-of-week', '1')
    localStorage.setItem('timezone', 'Asia/Shanghai')
    localStorage.setItem('default-view', 'month')

    const apiUpdateMock = vi.fn().mockResolvedValue({ settings: {} })
    const migrated: string[] = []

    const settingKeyMap: Record<string, string> = {
      'preferred-language': 'language',
      'first-day-of-week': 'firstDayOfWeek',
      timezone: 'timezone',
      'default-view': 'defaultView',
    }

    const migrations: Array<{
      key: string
      value: string | null
      transform?: (v: string) => unknown
    }> = [
      {
        key: 'preferred-language',
        value: localStorage.getItem('preferred-language'),
      },
      {
        key: 'first-day-of-week',
        value: localStorage.getItem('first-day-of-week'),
        transform: (v) => Number(v),
      },
      {
        key: 'timezone',
        value: localStorage.getItem('timezone'),
      },
      {
        key: 'default-view',
        value: localStorage.getItem('default-view'),
      },
    ]

    for (const { key, value, transform } of migrations) {
      if (!value) continue
      const settingKey = settingKeyMap[key]
      const settingValue = transform ? transform(value) : value
      try {
        await apiUpdateMock({ [settingKey]: settingValue })
        migrated.push(settingKey)
      } catch {
        // skip
      }
    }

    expect(migrated).toEqual([
      'language',
      'firstDayOfWeek',
      'timezone',
      'defaultView',
    ])
    expect(apiUpdateMock).toHaveBeenCalledTimes(4)
    expect(apiUpdateMock).toHaveBeenCalledWith({ language: 'zh' })
    expect(apiUpdateMock).toHaveBeenCalledWith({ firstDayOfWeek: 1 })
    expect(apiUpdateMock).toHaveBeenCalledWith({ timezone: 'Asia/Shanghai' })
    expect(apiUpdateMock).toHaveBeenCalledWith({ defaultView: 'month' })
  })

  it('skips missing localStorage keys', async () => {
    localStorage.setItem('timezone', 'UTC')

    const apiUpdateMock = vi.fn().mockResolvedValue({ settings: {} })
    const migrated: string[] = []

    const settingKeyMap: Record<string, string> = {
      'preferred-language': 'language',
      'first-day-of-week': 'firstDayOfWeek',
      timezone: 'timezone',
      'default-view': 'defaultView',
    }

    const migrations: Array<{
      key: string
      value: string | null
      transform?: (v: string) => unknown
    }> = [
      {
        key: 'preferred-language',
        value: localStorage.getItem('preferred-language'),
      },
      {
        key: 'first-day-of-week',
        value: localStorage.getItem('first-day-of-week'),
        transform: (v) => Number(v),
      },
      { key: 'timezone', value: localStorage.getItem('timezone') },
      { key: 'default-view', value: localStorage.getItem('default-view') },
    ]

    for (const { key, value, transform } of migrations) {
      if (!value) continue
      const settingKey = settingKeyMap[key]
      const settingValue = transform ? transform(value) : value
      try {
        await apiUpdateMock({ [settingKey]: settingValue })
        migrated.push(settingKey)
      } catch {
        // skip
      }
    }

    expect(migrated).toEqual(['timezone'])
    expect(apiUpdateMock).toHaveBeenCalledTimes(1)
  })

  it('continues migration when one key fails', async () => {
    localStorage.setItem('preferred-language', 'en')
    localStorage.setItem('timezone', 'America/New_York')

    const apiUpdateMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ settings: {} })

    const migrated: string[] = []

    const settingKeyMap: Record<string, string> = {
      'preferred-language': 'language',
      timezone: 'timezone',
    }

    const migrations: Array<{
      key: string
      value: string | null
    }> = [
      {
        key: 'preferred-language',
        value: localStorage.getItem('preferred-language'),
      },
      { key: 'timezone', value: localStorage.getItem('timezone') },
    ]

    for (const { key, value } of migrations) {
      if (!value) continue
      try {
        await apiUpdateMock({ [settingKeyMap[key]]: value })
        migrated.push(settingKeyMap[key])
      } catch {
        // skip failed item, continue with next
      }
    }

    expect(migrated).toEqual(['timezone'])
    expect(apiUpdateMock).toHaveBeenCalledTimes(2)
  })
})
