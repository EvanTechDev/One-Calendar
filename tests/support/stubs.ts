import { vi } from 'bun:test'

const globals = new Map<string, PropertyDescriptor | undefined>()
const environment = new Map<string, string | undefined>()

export function stubGlobal(name: string, value: unknown) {
  if (!globals.has(name))
    globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
}

export function unstubAllGlobals() {
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  globals.clear()
}

export function stubEnv(name: string, value: string | undefined) {
  if (!environment.has(name)) environment.set(name, process.env[name])
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

export function unstubAllEnvs() {
  for (const [name, value] of environment) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  environment.clear()
}

export async function advanceTimersByTimeAsync(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds)
  await Promise.resolve()
}
