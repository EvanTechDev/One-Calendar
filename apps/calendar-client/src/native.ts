export interface DesktopConfig {
  environment: 'dev' | 'production'
  apiOrigin: string
  appName: string
  version: string
}

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
      }
    }
  }
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const native = window.__TAURI__?.core
  if (!native) throw new Error('Open the installed Zentra desktop application.')
  return native.invoke<T>(command, args)
}

export function openExternal(destination: string) {
  return invoke<void>('open_external', { destination })
}
