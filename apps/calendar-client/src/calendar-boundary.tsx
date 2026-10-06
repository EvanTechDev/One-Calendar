import { Component, type ReactNode } from 'react'
import { Button } from '@zntr/ui/button'

export class CalendarBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="desktop-welcome">
        <section className="welcome-panel space-y-4" role="alert">
          <h1>Calendar could not open</h1>
          <p>Your calendar is stored online. Reload the app to try again.</p>
          <Button onClick={() => window.location.reload()}>
            Reload calendar
          </Button>
        </section>
      </main>
    )
  }
}
