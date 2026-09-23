import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data/defaults'
import { getRoutineInsights } from './insights'
import type { DayCheckIn, Habit, HabitLog } from './types'

const habit: Habit = {
  id: 'habit:test', name: 'Teste', category: 'health', objective: 'Teste', minimumVersion: 'Teste',
  frequency: { type: 'daily' }, status: 'active', phaseId: 'phase:test', xpReward: 10, level: 1,
  currentXp: 0, sortOrder: 1, startsOn: '2026-07-01', createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z'
}

const log = (date: string, status: HabitLog['status']): HabitLog => ({
  id: `log:${date}`, habitId: habit.id, date, status, updatedAt: `${date}T12:00:00Z`
})

describe('getRoutineInsights', () => {
  it('não inventa padrões quando não há amostra suficiente', () => {
    expect(getRoutineInsights({ habits: [habit], habitLogs: [], sleepLogs: [], dayCheckIns: [], waterLogs: [], settings: DEFAULT_SETTINGS, endDate: '2026-08-12' })).toEqual([])
  })

  it('explica uma tendência usando apenas dias registrados', () => {
    const dates = ['2026-07-30','2026-07-31','2026-08-01','2026-08-06','2026-08-07','2026-08-08']
    const logs = dates.map((date, index) => log(date, index < 3 ? 'missed' : 'done'))
    const result = getRoutineInsights({ habits: [habit], habitLogs: logs, sleepLogs: [], dayCheckIns: [], waterLogs: [], settings: DEFAULT_SETTINGS, endDate: '2026-08-12' })
    expect(result[0]).toMatchObject({ id: 'completion-trend', tone: 'positive' })
    expect(result[0].evidence).toContain('0% antes → 100% agora')
  })

  it('só relaciona sobrecarga quando existem dois grupos observados', () => {
    const dates = ['2026-08-01','2026-08-02','2026-08-03','2026-08-04']
    const logs = dates.map((date, index) => log(date, index < 2 ? 'done' : 'missed'))
    const checkIns: DayCheckIn[] = dates.map((date, index) => ({ id: date, date, overload: index < 2 ? 1 : 5, updatedAt: `${date}T12:00:00Z` }))
    const result = getRoutineInsights({ habits: [habit], habitLogs: logs, sleepLogs: [], dayCheckIns: checkIns, waterLogs: [], settings: DEFAULT_SETTINGS, endDate: '2026-08-12' })
    expect(result.some((insight) => insight.id === 'overload-impact')).toBe(true)
  })
})
