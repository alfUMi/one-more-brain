import { onBeforeUnmount } from 'vue'
import { tap } from '../lib/actions'

/**
 * "Hold for more": fires after 450 ms without moving. A press that fired swallows the click that
 * follows, so holding never also opens the item.
 */
export function useLongPress(onHold: () => void, ms = 450) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let start: { x: number; y: number } | null = null
  let fired = false

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    start = null
  }

  function onPointerdown(e: PointerEvent) {
    fired = false
    start = { x: e.clientX, y: e.clientY }
    timer = setTimeout(() => {
      fired = true
      timer = null
      tap()
      onHold()
    }, ms)
  }

  function onPointermove(e: PointerEvent) {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel()
  }

  /** Use as a capturing click handler: stops the click after a hold. */
  function onClickCapture(e: Event) {
    if (fired) {
      e.stopPropagation()
      e.preventDefault()
      fired = false
    }
  }

  onBeforeUnmount(cancel)

  return {
    onPointerdown,
    onPointermove,
    onPointerup: cancel,
    onPointercancel: cancel,
    onPointerleave: cancel,
    onContextmenu: (e: Event) => e.preventDefault(),
    onClickCapture,
  }
}
