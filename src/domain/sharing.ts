import { subDays } from 'date-fns'
import { fromDateKey, toDateKey } from './date'
import { getDailyCompletion } from './metrics'
import type { Habit, HabitLog, SleepLog, DayCheckIn, TherapyNote, LifeOSSettings } from './types'
export type ShareSection = 'habits' | 'sleep' | 'checkins' | 'notes'
export type ShareSnapshot = {
  version: 1; alias: string; throughDate: string; sections: ShareSection[]
  days: Array<{ date: string; percentage: number | null }>
  habits: Array<{ date: string; name: string; status: string }>
  sleep: Array<{ date: string; minutes: number | null; quality: number | null }>
  checkins: Array<{ date: string; mood: number | null; energy: number | null; overload: number | null }>
  notes: Array<{ date: string; content: string }>
}
export function makeSharedSnapshot(input: { habits: Habit[]; habitLogs: HabitLog[]; sleepLogs: SleepLog[]; dayCheckIns: DayCheckIn[]; therapyNotes: TherapyNote[]; settings: LifeOSSettings; throughDate: string }, sections: ShareSection[], alias: string): ShareSnapshot {
  const start=toDateKey(subDays(fromDateKey(input.throughDate),29))
  const range=(date:string)=>date>=start && date<=input.throughDate
  const enabled=(section:ShareSection)=>sections.includes(section)
  return {version:1,alias:alias.trim().slice(0,60),throughDate:input.throughDate,sections:[...new Set(sections)],
    days: enabled('habits') ? Array.from({length:30},(_,i)=>{
      const date=toDateKey(subDays(fromDateKey(input.throughDate),29-i))
      return {date,percentage:getDailyCompletion(input.habits,input.habitLogs,date,input.settings.completion).percentage}
    }) : [],
    habits: enabled('habits') ? input.habitLogs.filter(l=>range(l.date)).slice(-1000).map(l=>({date:l.date,name:input.habits.find(h=>h.id===l.habitId)?.name ?? 'Hábito removido',status:l.status})) : [],
    sleep: enabled('sleep') ? input.sleepLogs.filter(l=>range(l.date)).map(l=>({date:l.date,minutes:l.durationMinutes ?? null,quality:l.quality ?? null})) : [],
    checkins: enabled('checkins') ? input.dayCheckIns.filter(l=>range(l.date)).map(l=>({date:l.date,mood:l.mood ?? null,energy:l.energy ?? null,overload:l.overload ?? null})) : [],
    notes: enabled('notes') ? input.therapyNotes.filter(l=>l.shared && range(l.date)).slice(-1000).map(l=>({date:l.date,content:l.content})) : [],
  }
}
