import { afterAll, afterEach, expect, setDefaultTimeout } from 'bun:test'
import { JSDOM } from 'jsdom'

// Keep Bun's crypto, fetch, typed arrays and timers in their native realm.
// Only browser APIs belong to jsdom; jose and database tests need real globals.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
// Real Radix focus/exit transitions can exceed Bun's five-second default on
// constrained devices. Keep the same bounded timeout for every browser test.
setDefaultTimeout(30_000)
for (const name of Object.getOwnPropertyNames(dom.window)) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => (dom.window as any)[name],
    })
  }
}
for (const name of [
  'window',
  'document',
  'navigator',
  'Event',
  'CustomEvent',
  'EventTarget',
  'MouseEvent',
  'KeyboardEvent',
  'HTMLElement',
  'Node',
  'MutationObserver',
  'getComputedStyle',
  'localStorage',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: (dom.window as any)[name],
  })
}
// Browser globals and window expose the same live API, including spies.
globalThis.getComputedStyle = (...args) => dom.window.getComputedStyle(...args)
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  writable: true,
  value: true,
})
const matchers = await import('@testing-library/jest-dom/matchers')
expect.extend(matchers)

// Explicit cleanup: Testing Library's automatic registration depends on globals
// that are intentionally not installed by the Bun test runner.
const { cleanup } = await import('@testing-library/react')
afterEach(cleanup)
afterAll(() => dom.window.close())
