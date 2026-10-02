import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The language store behind `useLanguage()`.
 *
 * The behaviour worth pinning is not the hook but the paths that reach it:
 * the stored value has to be there on the FIRST render (it used to arrive
 * from a mount effect, so every consumer painted English first and then
 * swapped), and the three ways a language can change — a setter, another
 * tab's `storage` write, and the `languagechange` CustomEvent the onboarding
 * flow dispatches — have to reach every subscriber.
 *
 * The store is module-level state, so each test re-imports it. Without
 * `resetModules` the first test would pin `currentLanguage` for the rest of
 * the file and the rest would pass for the wrong reason.
 */

type I18n = typeof import('@zntr/i18n/calendar')

// Each test needs its own module registry (the store is module-level state),
// and importing @zntr/i18n/calendar merges all 35 locale dictionaries into one
// object at module scope. That makes a single import cost on the order of a
// second under load, which overruns the 5s default once a dozen of them are
// running in parallel. It is also the reason shipping every locale is worth
// revisiting: that work happens on the main thread of the real app too.
vi.setConfig({ testTimeout: 30_000 })

const loadI18n = async (): Promise<I18n> => {
  vi.resetModules()
  return (await import('@zntr/i18n/calendar')) as I18n
}

describe('language store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the stored language on the first paint, not after an effect', async () => {
    localStorage.setItem('preferred-language', 'zh-CN')
    const { useLanguage } = await loadI18n()

    // Every value the component rendered, in order. `renderHook` flushes
    // effects inside act(), so the settled value alone cannot tell the two
    // implementations apart — both end at 'zh-CN'. What the user actually saw
    // is the sequence: the old hook rendered 'en', then swapped to 'zh-CN'
    // from a mount effect, which is the text flash on every non-English cold
    // load. This asserts there is no first paint to flash.
    const renders: string[] = []
    renderHook(() => {
      const [language] = useLanguage()
      renders.push(language)
      return language
    })

    expect(renders).toEqual(['zh-CN'])
  })

  it('normalises a loosely-tagged stored value', async () => {
    localStorage.setItem('preferred-language', 'ZH-cn')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    expect(result.current[0]).toBe('zh-CN')
  })

  it('falls back to the system language when nothing is stored', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    expect(result.current[0]).toBe('de')
  })

  it('falls back to English when the stored value is not a supported language', async () => {
    localStorage.setItem('preferred-language', 'klingon')
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    expect(result.current[0]).toBe('en')
  })

  it('persists and publishes when the setter is used', async () => {
    localStorage.setItem('preferred-language', 'en')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => result.current[1]('fr'))

    expect(result.current[0]).toBe('fr')
    expect(localStorage.getItem('preferred-language')).toBe('fr')
  })

  it('gives every subscriber the same value', async () => {
    localStorage.setItem('preferred-language', 'en')
    const { useLanguage } = await loadI18n()

    const first = renderHook(() => useLanguage())
    const second = renderHook(() => useLanguage())

    act(() => second.result.current[1]('ja'))

    // Previously each call site owned an independent useState, so these could
    // disagree; they converged only because the setters fanned a window event
    // back out to all of them.
    expect(first.result.current[0]).toBe('ja')
    expect(second.result.current[0]).toBe('ja')
  })

  it('leaves the value alone when the setter is handed the current language', async () => {
    localStorage.setItem('preferred-language', 'it')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => result.current[1]('it'))

    expect(result.current[0]).toBe('it')
  })

  it('picks up the languagechange event the onboarding flow dispatches', async () => {
    localStorage.setItem('preferred-language', 'en')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('languagechange', { detail: { language: 'ko' } }),
      )
    })

    expect(result.current[0]).toBe('ko')
    // The dispatcher is not the store, so the store has to persist on its
    // behalf — otherwise a reload loses the choice.
    expect(localStorage.getItem('preferred-language')).toBe('ko')
  })

  it('ignores a languagechange event carrying an unsupported language', async () => {
    localStorage.setItem('preferred-language', 'sv')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => {
      window.dispatchEvent(
        new CustomEvent('languagechange', { detail: { language: 'nope' } }),
      )
    })

    expect(result.current[0]).toBe('sv')
    expect(localStorage.getItem('preferred-language')).toBe('sv')
  })

  it('picks up a storage write from another tab', async () => {
    localStorage.setItem('preferred-language', 'pt')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'preferred-language',
          newValue: 'zh-TW',
        }),
      )
    })

    expect(result.current[0]).toBe('zh-TW')
  })

  it('ignores a storage write to an unrelated key', async () => {
    localStorage.setItem('preferred-language', 'pl')
    const { useLanguage } = await loadI18n()

    const { result } = renderHook(() => useLanguage())

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'timezone',
          newValue: 'Asia/Tokyo',
        }),
      )
    })

    expect(result.current[0]).toBe('pl')
  })

  it('drops its subscriber on unmount without throwing', async () => {
    localStorage.setItem('preferred-language', 'en')
    const { useLanguage } = await loadI18n()

    const first = renderHook(() => useLanguage())
    first.unmount()
    const second = renderHook(() => useLanguage())

    expect(() => act(() => second.result.current[1]('ru'))).not.toThrow()
    expect(second.result.current[0]).toBe('ru')
  })

  it('resolves getStoredLanguage from the same rules', async () => {
    localStorage.setItem('preferred-language', 'zh-HK')
    const { getStoredLanguage } = await loadI18n()

    await expect(getStoredLanguage()).resolves.toBe('zh-HK')
  })

  it('resolves getStoredLanguage to English with nothing stored and no navigator language', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('')
    const { getStoredLanguage } = await loadI18n()

    await expect(getStoredLanguage()).resolves.toBe('en')
  })
})
