import { invoke } from '@tauri-apps/api/core'

// Keep the error surface independent of React and the shared calendar chunk.
// The native smoke check still waits for App's real desktop_config invocation.
void import('./main').catch((error: unknown) => {
  void invoke('desktop_startup_error', { message: String(error) }).catch(
    () => {},
  )
  const root = document.getElementById('root')
  if (!root) return
  const message = document.createElement('p')
  message.textContent = 'Zentra Calendar could not start. Please retry.'
  const retry = document.createElement('button')
  retry.textContent = 'Retry'
  retry.addEventListener('click', () => window.location.reload())
  root.replaceChildren(message, retry)
})
