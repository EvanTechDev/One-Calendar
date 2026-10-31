import { mock as moduleMock } from 'bun:test'
const { unstubAllGlobals, stubGlobal } = await import('./../support/stubs')
await import('./../support/dom')
import { afterEach, expect, it, vi } from 'bun:test'
const { render } = await import('@testing-library/react')

moduleMock.module('../../packages/auth/src/forms/context', () => ({
  useAuthForm: () => ({
    brand: { appName: 'Zentra Calendar', blurb: 'Calendar' },
  }),
}))
const { AuthLayout } = await import('../../packages/auth/src/forms/auth-layout')

afterEach(() => {
  vi.restoreAllMocks()
  unstubAllGlobals()
})

it('keeps the left artwork still and redraws only on resize', () => {
  const draw = vi.fn()
  const uniformTime = vi.fn()
  const noop = vi.fn()
  const gl = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name === 'drawArrays') return draw
        if (name === 'uniform1f') return uniformTime
        if (String(name).startsWith('create')) return () => ({})
        if (name === 'getShaderParameter' || name === 'getProgramParameter')
          return () => true
        if (name === 'getUniformLocation')
          return (_: unknown, key: string) => key
        return noop
      },
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    gl as WebGLRenderingContext,
  )
  const frame = vi.spyOn(window, 'requestAnimationFrame')
  let resize = () => {}
  const disconnect = vi.fn()
  stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe() {}
      disconnect = disconnect
    },
  )
  const view = render(
    <AuthLayout title="Sign in" description="Welcome">
      Form
    </AuthLayout>,
  )
  expect(draw).toHaveBeenCalledTimes(1)
  expect(uniformTime).toHaveBeenLastCalledWith('u_time', 0)
  expect(frame).not.toHaveBeenCalled()
  resize()
  expect(draw).toHaveBeenCalledTimes(2)
  expect(uniformTime).toHaveBeenLastCalledWith('u_time', 0)
  view.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
})
