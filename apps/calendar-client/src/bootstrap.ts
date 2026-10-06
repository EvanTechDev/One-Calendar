import { invoke } from '@tauri-apps/api/core'
import './bootstrap.css'

// Keep the error surface independent of React and the shared calendar chunk.
// The native smoke check still waits for App's real desktop_config invocation.
void import('./main').catch((error: unknown) => {
  void invoke('desktop_startup_error', { message: String(error) }).catch(
    () => {},
  )
  const root = document.getElementById('root')
  if (!root) return
  const surface = document.createElement('main')
  surface.id = 'desktop-startup-failure'
  const brand = document.createElement('header')
  brand.textContent = 'Zentra Calendar'
  const section = document.createElement('section')
  section.setAttribute('role', 'alert')
  const heading = document.createElement('h1')
  heading.textContent = 'Let’s reopen your calendar'
  const message = document.createElement('p')
  message.textContent =
    'The app could not finish starting. Reload Zentra to try again.'
  const retry = document.createElement('button')
  retry.textContent = 'Reload calendar'
  retry.addEventListener('click', () => window.location.reload())
  section.append(heading, message, retry)
  surface.append(brand, section)
  root.replaceChildren(surface)
})
