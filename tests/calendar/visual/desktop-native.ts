// Presentation fixture only; the installed-app smoke tests exercise real IPC.
export async function invoke(command: string) {
  if (command === 'desktop_check_update') return null
  throw new Error(`Unexpected visual-fixture command: ${command}`)
}
export async function listen() {
  return () => {}
}
