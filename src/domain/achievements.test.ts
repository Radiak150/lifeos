import { describe, expect, it } from 'vitest'
import { getAchievements, type AchievementId, type AchievementsInput } from './achievements'
import { calculateHabitStreak } from './metrics'
import type { Habit, HabitLog, SleepLog } from './types'

const habit: Habit = {
  id: 'habit:test', name: 'Escovar dentes', category: 'health', objective: 'Cuidar', minimumVersion: 'Escovar',
  frequency: { type: 'daily' }, status: 'active', phaseId: 'phase:1', xpReward: 80, level: 99, currentXp: 99,
  sortOrder: 0, startsOn: '2026-09-01', createdAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z'
}
const log = (day: number, status: HabitLog['status'] = 'done', xpAwarded = 10): HabitLog => {
  const date = `2026-09-${String(day).padStart(2, '0')}`
  return { id: `habit-log:${habit.id}:${date}`, habitId: habit.id, date, status, xpAwarded, updatedAt: `${date}T12:00:00Z` }
}
const input = (overrides: Partial<AchievementsInput> = {}): AchievementsInput => ({ habits: [habit], habitLogs: [], sleepLogs: [], dayCheckIns: [], throughDate: '2026-09-15', ...overrides })
const milestone = (result: ReturnType<typeof getAchievements>, id: AchievementId) => result.achievements.find((item) => item.id === id)!

describe('getAchievements', () => {
  it('starts empty without deriving progress from habit level or configured reward', () => {
    const result = getAchievements(input())
    expect(result).toMatchObject({ totalXp: 0, level: 1, levelXp: 0, xpToNextLevel: 100, unlockedCount: 0, recordedDays: 0 })
    expect(result.achievements.every((item) => !item.achievedOn)).toBe(true)
  })

  it('sums frozen rewards only and gives no badge bonus', () => {
    const result = getAchievements(input({ habitLogs: [log(1, 'done', 60), log(2, 'partial', 40), log(3, 'missed', 100), { ...log(4), xpAwarded: undefined }] }))
    expect(result).toMatchObject({ totalXp: 100, level: 2, levelXp: 0, xpToNextLevel: 100 })
    expect(milestone(result, 'first-hundred')).toMatchObject({ unlocked: true, achievedOn: '2026-09-02' })
    expect(milestone(result, 'first-step').achievedOn).toBe('2026-09-01')
  })

  it('recalculates on edits/deletions and deduplicates habit-day records', () => {
    const changed = { ...log(1, 'partial', 5), updatedAt: '2026-09-02T12:00:00Z' }
    const result = getAchievements(input({ habitLogs: [changed, log(1, 'done', 100)] }))
    expect(result.totalXp).toBe(5)
    expect(milestone(result, 'first-step').unlocked).toBe(false)
    expect(getAchievements(input()).totalXp).toBe(0)
  })

  it('ignores future, invalid, orphan and non-finite XP records', () => {
    const result = getAchievements(input({ habitLogs: [log(16, 'done', 100), { ...log(1), date: 'invalid' }, { ...log(2), habitId: 'deleted' }, log(3, 'partial', Number.NaN), log(4, 'partial', -10), log(5, 'partial', Number.POSITIVE_INFINITY)] }))
    expect(result.totalXp).toBe(0)
    expect(result.completedCount).toBe(0)
  })

  it('counts distinct recorded days across habits, sleep and check-ins without requiring consecutive days', () => {
    const sleep = (day: number): SleepLog => ({ id: `sleep:${day}`, date: log(day).date, sleepStartedAt: `${log(day).date}T01:00:00Z`, createdAt: habit.createdAt, updatedAt: habit.updatedAt })
    const result = getAchievements(input({ habitLogs: [log(1, 'missed', 0), log(3, 'skipped', 0), log(5, 'partial', 0)], sleepLogs: [sleep(5), sleep(7), sleep(9), sleep(9)], dayCheckIns: [11, 13, 16].map((day) => ({ id: log(day).date, date: log(day).date, energy: 1, updatedAt: habit.updatedAt })) }))
    expect(result.recordedDays).toBe(7)
    expect(milestone(result, 'recorded-week')).toMatchObject({ unlocked: true, achievedOn: '2026-09-13' })
    expect(milestone(result, 'sleep-three')).toMatchObject({ current: 3, unlocked: true, achievedOn: '2026-09-09' })
    expect(result.totalXp).toBe(0)
  })

  it('uses scheduled dates and skips excused days consistently with existing streak metrics', () => {
    const scheduled = { ...habit, frequency: { type: 'weekdays' as const, weekdays: [1, 3, 5] as (1 | 3 | 5)[] } }
    const habitLogs = [log(2), log(4, 'skipped', 0), log(7), log(9), log(11, 'partial', 5)]
    const result = getAchievements(input({ habits: [scheduled], habitLogs }))
    expect(result.bestStreak).toBe(calculateHabitStreak(scheduled, habitLogs, '2026-09-15').best)
    expect(milestone(result, 'streak-three')).toMatchObject({ unlocked: true, achievedOn: '2026-09-09' })
    expect(milestone(result, 'streak-seven').unlocked).toBe(false)
  })

  it('keeps a past seven-day milestone after a break and respects plan history', () => {
    const paused: Habit = { ...habit, status: 'paused', planHistory: [
      { effectiveFrom: '2026-09-01', startsOn: '2026-09-01', status: 'active', frequency: { type: 'daily' }, phaseId: habit.phaseId },
      { effectiveFrom: '2026-09-10', status: 'paused', frequency: { type: 'daily' }, phaseId: habit.phaseId }
    ] }
    const habitLogs = Array.from({ length: 7 }, (_, index) => log(index + 1))
    const result = getAchievements(input({ habits: [paused], habitLogs: [...habitLogs, log(9, 'missed', 0)] }))
    expect(result.bestStreak).toBe(7)
    expect(milestone(result, 'streak-seven')).toMatchObject({ unlocked: true, achievedOn: '2026-09-07' })
    const edited = getAchievements(input({ habits: [paused], habitLogs: habitLogs.filter((entry) => entry.date !== '2026-09-04') }))
    expect(edited.bestStreak).toBe(3)
    expect(milestone(edited, 'streak-seven')).toMatchObject({ unlocked: false, achievedOn: undefined })
  })
})
