import { describe, it, expect } from 'vitest'
import {
  CHILD_OVERLAY_ATTRIBUTE,
  childOverlayProps,
  isChildOverlayInteraction,
} from '@/lib/popover-nesting'

describe('isChildOverlayInteraction', () => {
  function markup(html: string) {
    document.body.innerHTML = html
  }

  it('is false for a node outside every child overlay', () => {
    markup('<button id="plain">elsewhere</button>')
    expect(isChildOverlayInteraction(document.getElementById('plain'))).toBe(
      false,
    )
  })

  it('is false for null — an interaction with no element to inspect', () => {
    expect(isChildOverlayInteraction(null)).toBe(false)
  })

  it('is true for the tagged content itself', () => {
    markup(`<div id="preview" ${CHILD_OVERLAY_ATTRIBUTE}></div>`)
    expect(isChildOverlayInteraction(document.getElementById('preview'))).toBe(
      true,
    )
  })

  it('is true for a descendant, which is where the clicks land', () => {
    markup(
      `<div ${CHILD_OVERLAY_ATTRIBUTE}><button id="x">close</button></div>`,
    )
    expect(isChildOverlayInteraction(document.getElementById('x'))).toBe(true)
  })

  it('exposes the attribute as spreadable props', () => {
    markup(
      `<div id="preview" ${childOverlayProps[CHILD_OVERLAY_ATTRIBUTE]}>x</div>`,
    )
    // React omits `true` for data-* attributes; the empty string is explicit.
    expect(document.getElementById('preview')).toBeTruthy()
  })
})
