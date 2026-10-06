import { Component, type ReactNode } from 'react'
import { DesktopState } from './desktop-surfaces'

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
    return <DesktopState failed />
  }
}
