/** Text and colors for the in-page toast; everything it needs travels as plain data. */
export interface ToastOptions {
  itemId: string
  message: string
  /** Shown instead of the actions (e.g. "Sign in first"); the toast just informs. */
  plain?: boolean
  addNote: string
  notePlaceholder: string
  noteSaved: string
  undo: string
  undone: string
}

/**
 * Shows "Saved to Inbox" with Add note and Undo at the bottom right of the page, as in the mockup.
 * Injected with `scripting.executeScript`, so it must be self-contained: no imports, no closures.
 * It lives in a shadow root so page styles cannot reach it.
 */
export function showToast(opts: ToastOptions) {
  const runtime = (
    globalThis as unknown as {
      chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } }
    }
  ).chrome.runtime
  const HOST_ID = 'omb-toast-host'
  document.getElementById(HOST_ID)?.remove()

  const host = document.createElement('div')
  host.id = HOST_ID
  host.style.cssText =
    'all: initial; position: fixed; right: 24px; bottom: 24px; z-index: 2147483647'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `
    <style>
      .t { display: flex; align-items: center; gap: 12px; min-height: 46px; box-sizing: border-box;
        padding: 7px 8px 7px 16px; border-radius: 12px; background: #15171c; color: #fff;
        box-shadow: 0 10px 30px rgba(21, 23, 28, .25); font: 400 14px/1.3 Inter, system-ui, sans-serif;
        max-width: min(520px, calc(100vw - 48px)); }
      .msg { flex: 1; min-width: 0 }
      button { height: 32px; padding: 0 12px; border: 0; border-radius: 8px; cursor: pointer;
        font: 600 13px Inter, system-ui, sans-serif; background: transparent; color: #c9ccd4 }
      button.solid { background: #2a2d35; color: #fff }
      button:hover { filter: brightness(1.2) }
      button:focus-visible, input:focus-visible { outline: 2px solid #7be0a3; outline-offset: 1px }
      input { flex: 1; min-width: 220px; height: 32px; box-sizing: border-box; padding: 0 10px;
        border: 1px solid #3c414d; border-radius: 8px; background: #22252c; color: #fff;
        font: 400 14px Inter, system-ui, sans-serif }
      svg { flex: none }
    </style>
    <div class="t" role="status" aria-live="polite">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7BE0A3" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>
      <span class="msg"></span>
    </div>`
  const box = root.querySelector('.t') as HTMLDivElement
  const msg = root.querySelector('.msg') as HTMLSpanElement
  msg.textContent = opts.message

  let timer = 0
  const close = () => host.remove()
  const later = (ms: number) => {
    clearTimeout(timer)
    timer = window.setTimeout(close, ms)
  }
  const finish = (text: string) => {
    box.querySelectorAll('button, input').forEach((el) => el.remove())
    msg.style.display = ''
    msg.textContent = text
    later(2500)
  }

  if (!opts.plain) {
    const note = document.createElement('button')
    note.className = 'solid'
    note.textContent = opts.addNote
    const undo = document.createElement('button')
    undo.textContent = opts.undo
    box.append(note, undo)

    note.addEventListener('click', () => {
      clearTimeout(timer)
      const input = document.createElement('input')
      input.placeholder = opts.notePlaceholder
      input.setAttribute('aria-label', opts.addNote)
      msg.style.display = 'none'
      note.replaceWith(input)
      input.focus()
      input.addEventListener('keydown', (e) => {
        e.stopPropagation()
        if (e.key === 'Escape') close()
        if (e.key !== 'Enter' || e.isComposing || !input.value.trim()) return
        void runtime.sendMessage({ type: 'omb:note', id: opts.itemId, text: input.value.trim() })
        finish(opts.noteSaved)
      })
    })
    undo.addEventListener('click', () => {
      void runtime.sendMessage({ type: 'omb:undo', id: opts.itemId })
      finish(opts.undone)
    })
    // Stay while the pointer is on it.
    host.addEventListener('mouseenter', () => clearTimeout(timer))
    host.addEventListener('mouseleave', () => {
      if (!root.querySelector('input')) later(4000)
    })
  }

  document.documentElement.append(host)
  later(opts.plain ? 4000 : 6000)
}
