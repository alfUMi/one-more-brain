/** Something that may move a notification changed (a reminder, an item, the digest settings). */
const listeners = new Set<() => void>()

export function onRemindersChanged(listener: () => void) {
  listeners.add(listener)
}

export function remindersChanged() {
  for (const listener of listeners) listener()
}
