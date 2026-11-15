/** A reminder picked in the UI, before it gets an id. */
export interface RemindChoice {
  kind: 'TIME' | 'RECURRING'
  fireAt: Date
  rrule?: string
}
