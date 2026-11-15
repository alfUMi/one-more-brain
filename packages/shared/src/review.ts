/** Spaced-repetition steps in days. "Got it" moves one step up; "Forgot" resets to the first step. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 90, 180] as const

const DAY_MS = 24 * 60 * 60 * 1000

export interface ReviewState {
  step: number
  lapses: number
}

export interface ReviewResult extends ReviewState {
  nextAt: Date
  /** True once the last step has been passed; the item stops coming back. */
  graduated: boolean
}

const LAST_STEP = REVIEW_INTERVALS_DAYS.length - 1

function intervalDays(step: number): number {
  return REVIEW_INTERVALS_DAYS[Math.min(Math.max(step, 0), LAST_STEP)] ?? 1
}

export function startReview(now: Date): ReviewResult {
  return { step: 0, lapses: 0, nextAt: addDays(now, intervalDays(0)), graduated: false }
}

export function answerReview(state: ReviewState, gotIt: boolean, now: Date): ReviewResult {
  if (!gotIt) {
    return {
      step: 0,
      lapses: state.lapses + 1,
      nextAt: addDays(now, intervalDays(0)),
      graduated: false,
    }
  }
  const next = state.step + 1
  if (next > LAST_STEP) {
    return {
      step: LAST_STEP,
      lapses: state.lapses,
      nextAt: addDays(now, intervalDays(LAST_STEP)),
      graduated: true,
    }
  }
  return {
    step: next,
    lapses: state.lapses,
    nextAt: addDays(now, intervalDays(next)),
    graduated: false,
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}
