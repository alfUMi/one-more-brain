import * as chrono from 'chrono-node'
import { formatRrule, nextOccurrence, type Recurrence, type Weekday } from './recurrence'
import { fromLocal, offsetMinutes, toLocal } from './time'

/**
 * Smart capture: pulls tags, a reminder and links out of free text (English and Russian).
 * Deterministic only; fuzzy phrases are left to the AI fallback on the server.
 */
export interface ParsedReminder {
  kind: 'TIME' | 'RECURRING'
  /** First time the reminder fires (UTC). */
  fireAt: Date
  rrule?: string
  /** The words that produced the reminder, as typed, and where they start in the text. */
  text: string
  index: number
}

export interface ParsedCapture {
  /** Text without #tags and !remember. */
  body: string
  tags: string[]
  remember: boolean
  reminder: ParsedReminder | null
  urls: string[]
}

export interface ParseOptions {
  now: Date
  timeZone: string
  /** Wall-clock hour used when a phrase has a date but no time ("friday"). */
  defaultHour?: number
}

// Unicode-aware word boundaries (\b only understands ASCII).
const B = String.raw`(?<![\p{L}\p{N}_])`
const E = String.raw`(?![\p{L}\p{N}_])`

const TAG_RE = new RegExp(String.raw`(^|\s)#([\p{L}\p{N}_-]{1,40})${E}`, 'gu')
const REMEMBER_RE = new RegExp(String.raw`(^|\s)!(remember|запомнить)${E}`, 'giu')
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi

export function parseCapture(text: string, opts: ParseOptions): ParsedCapture {
  const tags: string[] = []
  for (const m of text.matchAll(TAG_RE)) {
    const tag = m[2]!.toLowerCase()
    if (!tags.includes(tag)) tags.push(tag)
  }
  const remember = new RegExp(REMEMBER_RE.source, 'iu').test(text)
  const urls = [...text.matchAll(URL_RE)].map((m) => m[0])

  // Blank out URLs, tags and tokens (same length) so dates inside them are ignored and indexes stay valid.
  const blank = (s: string) => ' '.repeat(s.length)
  const scan = text
    .replace(URL_RE, blank)
    .replace(TAG_RE, blank)
    .replace(new RegExp(REMEMBER_RE.source, 'giu'), blank)

  const reminder = findRecurring(scan, text, opts) ?? findOneOff(scan, text, opts)

  const body = text
    .replace(TAG_RE, '$1')
    .replace(new RegExp(REMEMBER_RE.source, 'giu'), '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim()

  return { body, tags, remember, reminder, urls }
}

// ───────────────────────── One-off dates (chrono) ─────────────────────────

const CYRILLIC = /\p{Script=Cyrillic}/u

function findOneOff(scan: string, original: string, opts: ParseOptions): ParsedReminder | null {
  const ref = { instant: opts.now, timezone: offsetMinutes(opts.now, opts.timeZone) }
  const parsers = CYRILLIC.test(scan) ? [chrono.ru, chrono.en] : [chrono.en]
  for (const parser of parsers) {
    for (const r of parser.parse(scan, ref, { forwardDate: true })) {
      const s = r.start
      // A bare time ("at 6") or a bare weekday is fine; a bare number is not a date.
      if (!s.isCertain('day') && !s.isCertain('weekday') && !s.isCertain('hour')) continue
      let hour = s.isCertain('hour') ? s.get('hour')! : (opts.defaultHour ?? 9)
      const minute = s.isCertain('hour') ? (s.get('minute') ?? 0) : 0
      if (s.isCertain('hour') && !s.isCertain('meridiem')) hour = eveningHour(hour, r.text)
      const fireAt = fromLocal(
        { year: s.get('year')!, month: s.get('month')!, day: s.get('day')!, hour, minute },
        opts.timeZone,
      )
      if (fireAt.getTime() <= opts.now.getTime() + 60_000) continue
      return {
        kind: 'TIME',
        fireAt,
        text: original.slice(r.index, r.index + r.text.length),
        index: r.index,
      }
    }
  }
  return null
}

/** "at 6" almost always means 18:00 for reminders. "06:00" is explicit and kept. */
function eveningHour(hour: number, text: string): number {
  if (hour >= 1 && hour <= 6 && !/(^|\D)0\d[:.]\d\d/.test(text)) return hour + 12
  return hour
}

// ───────────────────────── Recurring phrases ─────────────────────────

const EN_DAYS: Record<string, Weekday> = {
  mon: 'MO',
  monday: 'MO',
  tue: 'TU',
  tues: 'TU',
  tuesday: 'TU',
  wed: 'WE',
  wednesday: 'WE',
  thu: 'TH',
  thur: 'TH',
  thurs: 'TH',
  thursday: 'TH',
  fri: 'FR',
  friday: 'FR',
  sat: 'SA',
  saturday: 'SA',
  sun: 'SU',
  sunday: 'SU',
}
const RU_DAYS: [RegExp, Weekday][] = [
  [/^понедельник/u, 'MO'],
  [/^вторник/u, 'TU'],
  [/^сред/u, 'WE'],
  [/^четверг/u, 'TH'],
  [/^пятниц/u, 'FR'],
  [/^суббот/u, 'SA'],
  [/^воскресень/u, 'SU'],
]
const WORKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR']

const EN_DAY = String.raw`(?:mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)(?:day|nesday|urday|sday)?`
const RU_DAY = String.raw`(?:понедельник\p{L}*|вторник\p{L}*|сред\p{L}*|четверг\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскресень\p{L}*)`

function enDay(word: string): Weekday | undefined {
  return EN_DAYS[word.toLowerCase()]
}
function ruDay(word: string): Weekday | undefined {
  return RU_DAYS.find(([re]) => re.test(word.toLowerCase()))?.[1]
}

type Partial = Omit<Recurrence, 'hour' | 'minute'>
interface Rule {
  re: RegExp
  build: (m: RegExpExecArray) => Partial | null
}

const UNIT_FREQ: Record<string, Recurrence['freq']> = {
  day: 'DAILY',
  week: 'WEEKLY',
  month: 'MONTHLY',
  year: 'YEARLY',
}
function ruUnit(word: string): Recurrence['freq'] | null {
  const w = word.toLowerCase()
  if (w.startsWith('дн') || w.startsWith('ден')) return 'DAILY'
  if (w.startsWith('недел')) return 'WEEKLY'
  if (w.startsWith('месяц')) return 'MONTHLY'
  if (w.startsWith('год') || w.startsWith('лет')) return 'YEARLY'
  return null
}

const rx = (s: string) => new RegExp(s, 'iu')

const RULES: Rule[] = [
  // English
  {
    re: rx(String.raw`${B}every\s+(weekday|work\s*day)s?${E}|${B}on\s+weekdays${E}`),
    build: () => ({ freq: 'WEEKLY', interval: 1, byDay: WORKDAYS }),
  },
  {
    re: rx(
      String.raw`${B}every\s+(${EN_DAY}(?:\s*(?:,|and|&)\s*${EN_DAY})*)${E}|${B}on\s+(${EN_DAY})s${E}`,
    ),
    build: (m) => {
      const days = (m[1] ?? m[2]!)
        .split(/\s*(?:,|and|&)\s*/i)
        .map(enDay)
        .filter((d): d is Weekday => Boolean(d))
      return days.length ? { freq: 'WEEKLY', interval: 1, byDay: days } : null
    },
  },
  {
    re: rx(String.raw`${B}every\s+(other\s+|\d{1,3}\s+)?(day|week|month|year)s?${E}`),
    build: (m) => ({
      freq: UNIT_FREQ[m[2]!.toLowerCase()]!,
      interval: m[1]?.trim().toLowerCase() === 'other' ? 2 : Number(m[1]?.trim() || 1),
    }),
  },
  {
    re: rx(String.raw`${B}(daily|weekly|monthly|yearly|annually)${E}`),
    build: (m) => {
      const w = m[1]!.toLowerCase()
      const freq = w === 'annually' ? 'YEARLY' : (`${w.toUpperCase()}` as Recurrence['freq'])
      return { freq, interval: 1 }
    },
  },
  // Russian
  {
    re: rx(String.raw`${B}по\s+будням${E}|${B}кажд\p{L}*\s+будн\p{L}*`),
    build: () => ({ freq: 'WEEKLY', interval: 1, byDay: WORKDAYS }),
  },
  {
    re: rx(String.raw`${B}(?:кажд\p{L}*|по)\s+(${RU_DAY}(?:\s*(?:,|и)\s*(?:${RU_DAY}))*)${E}`),
    build: (m) => {
      const days = m[1]!
        .split(/\s*(?:,|\sи\s)\s*/iu)
        .map(ruDay)
        .filter((d): d is Weekday => Boolean(d))
      return days.length ? { freq: 'WEEKLY', interval: 1, byDay: days } : null
    },
  },
  {
    re: rx(
      String.raw`${B}кажд\p{L}*\s+(\d{1,3}\s+)?(дн\p{L}*|день|недел\p{L}*|месяц\p{L}*|год\p{L}*|лет)${E}`,
    ),
    build: (m) => {
      const freq = ruUnit(m[2]!)
      return freq ? { freq, interval: Number(m[1]?.trim() || 1) } : null
    },
  },
  {
    re: rx(String.raw`${B}(ежедневно|еженедельно|ежемесячно|ежегодно)${E}`),
    build: (m) => {
      const w = m[1]!.toLowerCase()
      const freq = w.startsWith('ежедн')
        ? 'DAILY'
        : w.startsWith('еженед')
          ? 'WEEKLY'
          : w.startsWith('ежемес')
            ? 'MONTHLY'
            : 'YEARLY'
      return { freq, interval: 1 }
    },
  },
  {
    // "каждое 1 число", "каждого 15-го числа"
    re: rx(String.raw`${B}кажд\p{L}*\s+(\d{1,2})(?:-?\p{L}{1,2})?\s+числ\p{L}*`),
    build: (m) => ({ freq: 'MONTHLY', interval: 1, byMonthDay: Number(m[1]) }),
  },
]

/** Day of month: "on the 1st", "on 15th", "1-го числа", "1 числа". */
const MONTH_DAY_RE = rx(
  String.raw`${B}on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?${E}|${B}(\d{1,2})(?:-?\p{L}{1,2})?\s+числ\p{L}*`,
)

/** Times: "at 9", "at 9:30 pm", "18:00", "9am", "в 6", "в 7 утра". */
const MER = String.raw`(?<mer>am|pm|утра|дня|вечера|ночи)`
const TIME_RES: RegExp[] = [
  rx(String.raw`${B}(?<h>\d{1,2})[:.](?<m>\d{2})\s*${MER}?${E}`),
  rx(String.raw`${B}(?:at|в|во)\s+(?<h>\d{1,2})(?:[:.](?<m>\d{2}))?\s*${MER}?${E}`),
  rx(String.raw`${B}(?<h>\d{1,2})\s*${MER}${E}`),
]

function findTime(
  text: string,
): { hour: number; minute: number; index: number; end: number } | null {
  for (const re of TIME_RES) {
    const m = re.exec(text)
    if (!m?.groups) continue
    let hour = Number(m.groups.h)
    const minute = Number(m.groups.m ?? 0)
    const mer = m.groups.mer?.toLowerCase()
    if (hour > 23 || minute > 59) continue
    if (mer === 'pm' || mer === 'дня' || mer === 'вечера') {
      if (hour < 12) hour += 12
    } else if (mer === 'am' || mer === 'утра' || mer === 'ночи') {
      if (hour === 12) hour = 0
    } else {
      hour = eveningHour(hour, m[0])
    }
    return { hour, minute, index: m.index, end: m.index + m[0].length }
  }
  return null
}

function findRecurring(scan: string, original: string, opts: ParseOptions): ParsedReminder | null {
  for (const rule of RULES) {
    const m = rule.re.exec(scan)
    if (!m) continue
    const partial = rule.build(m)
    if (!partial) continue

    let start = m.index
    let end = m.index + m[0].length
    const monthDay = partial.byMonthDay ? null : MONTH_DAY_RE.exec(scan)
    if (monthDay && (partial.freq === 'MONTHLY' || partial.freq === 'DAILY')) {
      partial.freq = 'MONTHLY'
      partial.byMonthDay = Number(monthDay[1] ?? monthDay[2])
      start = Math.min(start, monthDay.index)
      end = Math.max(end, monthDay.index + monthDay[0].length)
    }
    const time = findTime(scan)
    if (time) {
      start = Math.min(start, time.index)
      end = Math.max(end, time.end)
    }
    const recurrence: Recurrence = {
      ...partial,
      hour: time?.hour ?? opts.defaultHour ?? 9,
      minute: time?.minute ?? 0,
    }
    // Weekly with no day named ("every week") repeats on today's weekday.
    const fireAt = nextOccurrence(recurrence, {
      anchor: anchorFor(recurrence, opts),
      after: opts.now,
      timeZone: opts.timeZone,
    })
    if (!fireAt) continue
    return {
      kind: 'RECURRING',
      fireAt,
      rrule: formatRrule(recurrence),
      text: original.slice(start, end),
      index: start,
    }
  }
  return null
}

/** Today at the rule's time, so intervals count from the day of capture. */
function anchorFor(r: Recurrence, opts: ParseOptions): Date {
  const l = toLocal(opts.now, opts.timeZone)
  return fromLocal({ ...l, hour: r.hour, minute: r.minute }, opts.timeZone)
}
