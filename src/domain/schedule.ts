import { addDays, format, getDay, isBefore, parse, startOfDay } from 'date-fns'
import type { ScheduleItem } from './types'
import { fromDateKey, todayKey, toDateKey } from './date'

export function isScheduleItemOnDate(item: ScheduleItem, date: Date) {
  if (!item.active) return false
  if (item.recurrence.type === 'daily') return true
  if (item.recurrence.type === 'one-off') return item.recurrence.date === toDateKey(date)
  return item.recurrence.weekdays.includes(getDay(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
}

export function getScheduleForDate(items: readonly ScheduleItem[], date: Date) {
  return items.filter((item) => isScheduleItemOnDate(item, date)).sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0) || a.startTime.localeCompare(b.startTime))
}

export function scheduleDateTime(date: Date, time: string, timeZone?: string) {
  if (!timeZone) return parse(`${format(date, 'yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', new Date())
  const [hours, minutes] = time.split(':').map(Number)
  const target = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes)
  let instant = target
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
    const wallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    const delta = target - wallTime
    instant += delta
    if (!delta) break
  }
  return new Date(instant)
}

export function getNextOccurrence(item: ScheduleItem, after = new Date(), timeZone?: string) {
  if (!item.active) return null
  if (item.recurrence.type === 'one-off') {
    const candidate = addDays(fromDateKey(item.recurrence.date), item.dayOffset ?? 0)
    const instant = scheduleDateTime(candidate, item.startTime, timeZone)
    return isBefore(instant, after) ? null : instant
  }
  const base = timeZone ? fromDateKey(todayKey(after, timeZone)) : startOfDay(after)
  for (let offset = -(item.dayOffset ?? 0); offset <= 7; offset += 1) {
    const candidate = addDays(base, offset)
    if (!isScheduleItemOnDate(item, candidate)) continue
    const dateTime = scheduleDateTime(addDays(candidate, item.dayOffset ?? 0), item.startTime, timeZone)
    if (!isBefore(dateTime, after)) return dateTime
  }
  return null
}
