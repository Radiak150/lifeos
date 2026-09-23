import { differenceInMinutes, parseISO } from 'date-fns'
import { lastNDateKeys } from './date'
import { getDailyCompletion } from './metrics'
import type { DayCheckIn, Habit, HabitLog, LifeOSSettings, SleepLog, WaterLog } from './types'

export type RoutineInsight = {
  id: string
  tone: 'positive' | 'attention' | 'neutral'
  title: string
  description: string
  evidence: string
}

type InsightInput = {
  habits: readonly Habit[]
  habitLogs: readonly HabitLog[]
  sleepLogs: readonly SleepLog[]
  dayCheckIns: readonly DayCheckIn[]
  waterLogs: readonly WaterLog[]
  settings: LifeOSSettings
  endDate: string
}

const average = (values: number[]) => values.length
  ? values.reduce((total, value) => total + value, 0) / values.length
  : null

function sleepMinutes(log: SleepLog) {
  if (typeof log.durationMinutes === 'number' && log.durationMinutes >= 0) return log.durationMinutes
  if (!log.wokeAt) return null
  const value = differenceInMinutes(parseISO(log.wokeAt), parseISO(log.sleepStartedAt))
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Regras explicáveis sobre registros reais. Nenhum insight é produzido sem
 * amostra mínima, e toda mensagem inclui a evidência usada no cálculo.
 */
export function getRoutineInsights(input: InsightInput): RoutineInsight[] {
  const dates = lastNDateKeys(input.endDate, 14)
  const previousDates = new Set(dates.slice(0, 7))
  const currentDates = new Set(dates.slice(7))
  const completions = dates.map((date) => getDailyCompletion(input.habits, input.habitLogs, date, input.settings))
  const previousCompletion = completions.filter((day) => previousDates.has(day.date) && day.percentage != null)
  const currentCompletion = completions.filter((day) => currentDates.has(day.date) && day.percentage != null)
  const insights: RoutineInsight[] = []

  if (previousCompletion.length >= 3 && currentCompletion.length >= 3) {
    const before = average(previousCompletion.map((day) => day.percentage!))!
    const now = average(currentCompletion.map((day) => day.percentage!))!
    const delta = Math.round(now - before)
    if (Math.abs(delta) >= 10) {
      insights.push({
        id: 'completion-trend',
        tone: delta > 0 ? 'positive' : 'attention',
        title: delta > 0 ? 'Sua constância está subindo' : 'Sua semana pediu mais margem',
        description: delta > 0
          ? 'A conclusão média melhorou em relação aos sete dias anteriores.'
          : 'A conclusão média caiu; vale reduzir o próximo passo em vez de adicionar hábitos.',
        evidence: `${Math.round(before)}% antes → ${Math.round(now)}% agora, considerando ${previousCompletion.length + currentCompletion.length} dias registrados.`
      })
    }
  }

  const completionByDate = new Map(completions.filter((day) => day.percentage != null).map((day) => [day.date, day.percentage!]))
  const highOverload = input.dayCheckIns
    .filter((entry) => dates.includes(entry.date) && (entry.overload ?? 0) >= 4 && completionByDate.has(entry.date))
    .map((entry) => completionByDate.get(entry.date)!)
  const lowOverload = input.dayCheckIns
    .filter((entry) => dates.includes(entry.date) && (entry.overload ?? 6) <= 2 && completionByDate.has(entry.date))
    .map((entry) => completionByDate.get(entry.date)!)
  if (highOverload.length >= 2 && lowOverload.length >= 2) {
    const high = average(highOverload)!
    const low = average(lowOverload)!
    const difference = Math.round(low - high)
    if (difference >= 10) {
      insights.push({
        id: 'overload-impact',
        tone: 'attention',
        title: 'Sobrecarga parece afetar a rotina',
        description: 'Nos dias de sobrecarga alta, sua conclusão foi menor. Este é um padrão para levar à terapia, não uma falha pessoal.',
        evidence: `${Math.round(high)}% com sobrecarga 4–5 versus ${Math.round(low)}% com sobrecarga 1–2.`
      })
    }
  }

  const sleepByPeriod = (period: Set<string>) => input.sleepLogs
    .filter((entry) => period.has(entry.date))
    .map(sleepMinutes)
    .filter((value): value is number => value != null)
  const previousSleep = sleepByPeriod(previousDates)
  const currentSleep = sleepByPeriod(currentDates)
  if (previousSleep.length >= 3 && currentSleep.length >= 3) {
    const before = average(previousSleep)!
    const now = average(currentSleep)!
    const delta = Math.round(now - before)
    if (Math.abs(delta) >= 30) {
      const direction = delta > 0 ? 'aumentou' : 'diminuiu'
      insights.push({
        id: 'sleep-trend',
        tone: delta > 0 ? 'positive' : 'attention',
        title: `Seu tempo médio de sono ${direction}`,
        description: 'Compare também horários e como você se sentiu; duração isolada não define qualidade do sono.',
        evidence: `${Math.floor(before / 60)}h${String(Math.round(before) % 60).padStart(2, '0')} antes → ${Math.floor(now / 60)}h${String(Math.round(now) % 60).padStart(2, '0')} agora.`
      })
    }
  }

  const currentWater = new Map<string, number>()
  for (const entry of input.waterLogs) {
    if (currentDates.has(entry.date) && entry.amountMl > 0) {
      currentWater.set(entry.date, (currentWater.get(entry.date) ?? 0) + entry.amountMl)
    }
  }
  if (currentWater.size >= 3 && input.settings.waterGoalMl > 0) {
    const totals = [...currentWater.values()]
    const mean = average(totals)!
    const goalDays = totals.filter((value) => value >= input.settings.waterGoalMl).length
    if (mean < input.settings.waterGoalMl * 0.75) {
      insights.push({
        id: 'water-below-goal',
        tone: 'neutral',
        title: 'Água pode continuar em passos pequenos',
        description: 'A média registrada ainda está distante da meta atual. Ajustar o incremento pode ser mais sustentável que cobrar o total de uma vez.',
        evidence: `${Math.round(mean)} ml de média em ${totals.length} dias; meta atual de ${input.settings.waterGoalMl} ml, alcançada em ${goalDays}.`
      })
    }
  }

  return insights.slice(0, 3)
}
