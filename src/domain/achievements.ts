import { dateKeysBetween, isDateKey } from './date'
import { isHabitDueOn } from './metrics'
import type { DateKey, DayCheckIn, Habit, HabitLog, SleepLog } from './types'

export type AchievementId = 'first-step' | 'recorded-week' | 'streak-three' | 'streak-seven' | 'first-hundred' | 'sleep-three'

export interface Achievement {
  id: AchievementId
  title: string
  description: string
  current: number
  target: number
  unit: string
  unlocked: boolean
  /** Dia ao qual o marco pertence, não o instante em que foi salvo. */
  achievedOn?: DateKey
}

export interface AchievementsInput {
  habits: readonly Habit[]
  habitLogs: readonly HabitLog[]
  sleepLogs: readonly SleepLog[]
  dayCheckIns: readonly DayCheckIn[]
  throughDate: DateKey
}

/** Somente evidências atuais: editar/excluir um registro também recalcula os marcos. */
export function getAchievements(input: AchievementsInput) {
  const habitIds = new Set(input.habits.map(({ id }) => id))
  const inRange = (date: DateKey) => isDateKey(date) && date <= input.throughDate
  const uniqueLogs = new Map<string, HabitLog>()
  // O banco já é único por hábito/dia; a normalização protege consumidores externos.
  for (const log of input.habitLogs) {
    if (!habitIds.has(log.habitId) || !inRange(log.date)) continue
    const key = `${log.habitId}:${log.date}`
    const previous = uniqueLogs.get(key)
    if (!previous || log.updatedAt >= previous.updatedAt) uniqueLogs.set(key, log)
  }
  const logs = [...uniqueLogs.values()].sort((a, b) => a.date.localeCompare(b.date))
  const doneLogs = logs.filter(({ status }) => status === 'done')
  const sleepDates = [...new Set(input.sleepLogs.filter((log) => inRange(log.date)).map(({ date }) => date))].sort()
  const recordedDates = [...new Set([
    ...logs.map(({ date }) => date),
    ...sleepDates,
    ...input.dayCheckIns.filter((entry) => inRange(entry.date)).map(({ date }) => date)
  ])].sort()

  let totalXp = 0
  let firstHundredOn: DateKey | undefined
  for (const log of logs) {
    // Não reavalia o prêmio atual do hábito nem inventa XP de registros antigos.
    const award = log.xpAwarded
    if ((log.status === 'done' || log.status === 'partial') && typeof award === 'number' && Number.isFinite(award) && award > 0) {
      totalXp += award
      if (totalXp >= 100 && !firstHundredOn) firstHundredOn = log.date
    }
  }

  let bestStreak = 0
  const streakDates = new Map<number, DateKey>()
  for (const habit of input.habits) {
    const habitLogs = logs.filter(({ habitId }) => habitId === habit.id)
    if (!habitLogs.length) continue
    const byDate = new Map(habitLogs.map((log) => [log.date, log]))
    let running = 0
    // Mesma regra de calculateHabitStreak: só dias devidos; pulados não quebram.
    for (const date of dateKeysBetween(habitLogs[0].date, habitLogs[habitLogs.length - 1].date)) {
      if (!isHabitDueOn(habit, date)) continue
      const status = byDate.get(date)?.status
      if (status === 'skipped') continue
      if (status !== 'done') { running = 0; continue }
      running += 1
      bestStreak = Math.max(bestStreak, running)
      for (const target of [3, 7]) {
        const previous = streakDates.get(target)
        if (running >= target && (!previous || date < previous)) streakDates.set(target, date)
      }
    }
  }

  const definitions: Omit<Achievement, 'unlocked'>[] = [
    { id: 'first-step', title: 'Primeiro passo', description: 'Concluir um hábito previsto. Um começo já conta.', current: doneLogs.length, target: 1, unit: 'conclusões', achievedOn: doneLogs[0]?.date },
    { id: 'recorded-week', title: 'Sua história começa', description: 'Registrar hábitos, sono ou check-in em 7 dias diferentes. Não precisam ser seguidos.', current: recordedDates.length, target: 7, unit: 'dias registrados', achievedOn: recordedDates[6] },
    { id: 'streak-three', title: 'Ritmo em construção', description: 'Concluir o mesmo hábito em 3 dias previstos seguidos. Dias livres e pulados são ignorados.', current: bestStreak, target: 3, unit: 'conclusões em sequência', achievedOn: streakDates.get(3) },
    { id: 'streak-seven', title: 'Constância no seu ritmo', description: 'Alcançar 7 conclusões seguidas do mesmo hábito nos dias previstos. Não precisa ser a sequência atual.', current: bestStreak, target: 7, unit: 'conclusões em sequência', achievedOn: streakDates.get(7) },
    { id: 'first-hundred', title: 'Cada passo soma', description: 'Somar 100 XP nos registros de hábitos, incluindo a recompensa parcial já salva.', current: totalXp, target: 100, unit: 'XP', achievedOn: firstHundredOn },
    { id: 'sleep-three', title: 'Conhecendo seu descanso', description: 'Registrar o sono em 3 dias diferentes, sem meta de duração ou qualidade.', current: sleepDates.length, target: 3, unit: 'dias com sono registrado', achievedOn: sleepDates[2] }
  ]
  const achievements: Achievement[] = definitions.map((item) => ({ ...item, unlocked: item.current >= item.target }))

  return {
    totalXp,
    level: Math.floor(totalXp / 100) + 1,
    levelXp: totalXp % 100,
    xpToNextLevel: 100 - totalXp % 100,
    completedCount: doneLogs.length,
    recordedDays: recordedDates.length,
    bestStreak,
    unlockedCount: achievements.filter(({ unlocked }) => unlocked).length,
    achievements
  }
}
