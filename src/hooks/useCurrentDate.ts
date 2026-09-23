import { useEffect, useState } from 'react'
import { todayKey } from '../domain/date'
import type { DateKey } from '../domain/types'

/** Mantem paginas abertas alinhadas com a data civil do workspace. */
export function useCurrentDate(timeZone: string): DateKey {
  const [date, setDate] = useState<DateKey>(() => todayKey(new Date(), timeZone))

  useEffect(() => {
    const refresh = () => setDate(todayKey(new Date(), timeZone))
    refresh()
    const interval = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [timeZone])

  return date
}
