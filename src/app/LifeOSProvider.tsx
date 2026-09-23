import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, makeHabitLogId, makeSleepLogId, seedDatabaseIfNeeded, type LifeOSDatabase } from '../data/db'
import { replaceDatabaseFromBackup, type LifeOSBackup, type LifeOSBackupV2 } from '../data/backup'
import { DEFAULT_IDS, DEFAULT_SETTINGS } from '../data/defaults'
import { validateCategories } from '../domain/categories'
import { getShareConnection } from '../lib/sharing'
import { isDateKey, todayKey } from '../domain/date'
import { hasFixedWeeklySchedule, isHabitDueOn, xpAwardForStatus } from '../domain/metrics'
import type {
  DayCheckIn,
  Habit,
  HabitFrequency,
  HabitLog,
  HabitLogStatus,
  LifeOSSettings,
  ModuleTask,
  ScheduleItem,
  SleepLog,
  TherapyNote,
  WaterLog
} from '../domain/types'

type HabitDraft = Pick<Habit, 'name' | 'category' | 'objective' | 'minimumVersion' | 'frequency' | 'status' | 'xpReward' | 'icon'> &
  Partial<Pick<Habit, 'id' | 'phaseId' | 'sortOrder' | 'startsOn' | 'endsOn'>>

type TaskDraft = Pick<ModuleTask, 'module' | 'title' | 'status'> & Partial<Pick<ModuleTask, 'id' | 'kind' | 'description' | 'priority' | 'dueDate' | 'progressPercent'>>

type SleepDraft = Pick<SleepLog, 'date' | 'sleepStartedAt'> & Partial<Pick<SleepLog, 'wokeAt' | 'quality' | 'interruptions' | 'note'>>

type ScheduleDraft = Pick<ScheduleItem, 'title' | 'category' | 'recurrence' | 'startTime' | 'protectedTime'> &
  Partial<Pick<ScheduleItem, 'id' | 'endTime' | 'dayOffset' | 'location' | 'note' | 'active' | 'color'>>

type TherapyNoteDraft = Pick<TherapyNote, 'date' | 'content' | 'shared'> & Partial<Pick<TherapyNote, 'id' | 'weekStart' | 'authorRole'>>

export type { LifeOSBackup } from '../data/backup'

type LifeOSContextValue = {
  ready: boolean
  error: string | null
  habits: Habit[]
  habitLogs: HabitLog[]
  sleepLogs: SleepLog[]
  dayCheckIns: DayCheckIn[]
  waterLogs: WaterLog[]
  scheduleItems: ScheduleItem[]
  moduleTasks: ModuleTask[]
  therapyNotes: TherapyNote[]
  settings: LifeOSSettings
  setHabitLog: (habitId: string, date: string, status: HabitLogStatus | null, note?: string) => Promise<void>
  saveHabit: (draft: HabitDraft) => Promise<string>
  removeHabit: (id: string) => Promise<void>
  saveSleepLog: (draft: SleepDraft) => Promise<void>
  saveDayCheckIn: (value: Omit<DayCheckIn, 'id' | 'updatedAt'>) => Promise<void>
  addWater: (date: string, amountMl: number) => Promise<void>
  removeWaterLog: (id: string) => Promise<void>
  saveTask: (draft: TaskDraft) => Promise<string>
  removeTask: (id: string) => Promise<void>
  saveScheduleItem: (draft: ScheduleDraft) => Promise<string>
  removeScheduleItem: (id: string) => Promise<void>
  saveTherapyNote: (draft: TherapyNoteDraft) => Promise<string>
  removeTherapyNote: (id: string) => Promise<void>
  updateSettings: (patch: Partial<LifeOSSettings>) => Promise<void>
  createBackup: () => Promise<LifeOSBackup>
  restoreBackup: (backup: LifeOSBackup) => Promise<void>
  resetLocalData: () => Promise<void>
}

const LifeOSContext = createContext<LifeOSContextValue | null>(null)

const nowIso = () => new Date().toISOString()
const createId = (prefix: string) => `${prefix}:${crypto.randomUUID()}`

async function applyHabitLog(
  database: LifeOSDatabase,
  habitId: string,
  date: string,
  status: HabitLogStatus | null,
  note?: string,
  now = new Date()
) {
  const id = makeHabitLogId(habitId, date)
  const [habit, previous, settings] = await Promise.all([
    database.habits.get(habitId),
    database.habitLogs.get(id),
    database.settings.get(DEFAULT_IDS.settings)
  ])
  if (!habit) throw new Error('Hábito não encontrado.')
  if (!isDateKey(date)) throw new Error('A data do hábito é inválida.')
  if (date > todayKey(now, settings?.timezone)) throw new Error('Não é possível registrar um hábito em uma data futura.')
  if (status !== null && !isHabitDueOn(habit, date)) throw new Error('Este hábito não estava previsto para a data informada.')
  const partialWeight = settings?.completion.partialWeight ?? DEFAULT_SETTINGS.completion.partialWeight
  const xpAwarded = xpAwardForStatus(status, habit.xpReward, partialWeight)
  if (status === null) await database.habitLogs.delete(id)
  else {
    const timestamp = now.toISOString()
    await database.habitLogs.put({
      id,
      habitId,
      date,
      status,
      note: note?.trim() || undefined,
      xpAwarded,
      completedAt: status === 'done' ? timestamp : undefined,
      updatedAt: timestamp
    })
  }
  const delta = xpAwarded - (previous?.xpAwarded ?? 0)
  if (delta !== 0) {
    const nextXp = Math.max(0, habit.currentXp + delta)
    await database.habits.update(habitId, { currentXp: nextXp, level: Math.floor(nextXp / 100) + 1, updatedAt: now.toISOString() })
  }
}

async function setHabitLogInDatabase(
  database: LifeOSDatabase,
  habitId: string,
  date: string,
  status: HabitLogStatus | null,
  note?: string,
  now = new Date()
) {
  if (habitId === DEFAULT_IDS.habit.water) throw new Error('Registre a quantidade de água para atualizar este hábito.')
  if (habitId === DEFAULT_IDS.habit.registerSleep) {
    throw new Error('O hábito de sono só pode ser atualizado ao salvar um registro de sono.')
  }
  await database.transaction('rw', database.habits, database.habitLogs, database.settings, async () => {
    await applyHabitLog(database, habitId, date, status, note, now)
  })
}

async function saveSleepLogInDatabase(database: LifeOSDatabase, draft: SleepDraft, now = new Date()) {
  const timestamp = now.toISOString()
  const start = new Date(draft.sleepStartedAt)
  const end = draft.wokeAt ? new Date(draft.wokeAt) : undefined
  if (!Number.isFinite(start.getTime())) throw new Error('O horário em que o sono começou é inválido.')
  if (end && !Number.isFinite(end.getTime())) throw new Error('O horário de despertar é inválido.')
  if (start > now || (end && end > now)) throw new Error('Não é possível registrar horários de sono no futuro.')
  if (end && end < start) throw new Error('O horário de despertar não pode vir antes do início do sono.')
  const durationMinutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : undefined
  await database.transaction('rw', database.sleepLogs, database.habits, database.habitLogs, database.settings, async () => {
    const settings = await database.settings.get(DEFAULT_IDS.settings)
    if (!isDateKey(draft.date)) throw new Error('A data do sono é inválida.')
    if (draft.date > todayKey(now, settings?.timezone)) throw new Error('Não é possível registrar sono em uma data futura.')
    const id = makeSleepLogId(draft.date)
    const existing = await database.sleepLogs.get(id)
    await database.sleepLogs.put({
      id,
      date: draft.date,
      sleepStartedAt: draft.sleepStartedAt,
      wokeAt: draft.wokeAt,
      durationMinutes,
      quality: draft.quality,
      interruptions: draft.interruptions,
      note: draft.note?.trim() || undefined,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    })
    const sleepHabit = await database.habits.get(DEFAULT_IDS.habit.registerSleep)
    if (sleepHabit && isHabitDueOn(sleepHabit, draft.date)) {
      await applyHabitLog(database, DEFAULT_IDS.habit.registerSleep, draft.date, 'done', undefined, now)
    }
  })
}

async function saveHabitInDatabase(database: LifeOSDatabase, draft: HabitDraft, now = new Date()) {
  const timestamp = now.toISOString()
  const id = draft.id ?? createId('habit')
  const frequency: HabitFrequency = draft.frequency
  if (!hasFixedWeeklySchedule(frequency)) {
    throw new Error('Uma meta semanal precisa ter exatamente a mesma quantidade de dias preferidos que a meta.')
  }
  await database.transaction('rw', database.habits, database.settings, async () => {
    const [existing, settings] = await Promise.all([
      database.habits.get(id),
      database.settings.get(DEFAULT_IDS.settings)
    ])
    const effectiveFrom = todayKey(now, settings?.timezone)
    const isActivation = existing?.status === 'future' && draft.status !== 'future'
    const staleFuturePhase = draft.phaseId === 'phase:future' && draft.status !== 'future'
    const phaseId = draft.status === 'future'
      ? draft.phaseId ?? 'phase:future'
      : draft.phaseId && !isActivation && !staleFuturePhase
        ? draft.phaseId
        : settings?.activePhaseId ?? DEFAULT_SETTINGS.activePhaseId
    const startsOn = draft.startsOn ?? existing?.startsOn ?? (draft.status === 'future' ? undefined : effectiveFrom)
    const nextPlan = { effectiveFrom, status: draft.status, frequency, phaseId, startsOn, endsOn: draft.endsOn }
    const planHistory = [...(existing?.planHistory ?? [])]
    const existingToday = planHistory.findIndex((plan) => plan.effectiveFrom === effectiveFrom)
    if (existingToday >= 0) planHistory[existingToday] = nextPlan
    else planHistory.push(nextPlan)
    planHistory.sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))

    await database.habits.put({
      id,
      name: draft.name.trim(),
      category: draft.category,
      objective: draft.objective.trim(),
      minimumVersion: draft.minimumVersion.trim(),
      frequency,
      status: draft.status,
      phaseId,
      xpReward: Math.max(0, Math.round(draft.xpReward)),
      level: existing?.level ?? 1,
      currentXp: existing?.currentXp ?? 0,
      sortOrder: draft.sortOrder ?? existing?.sortOrder ?? now.getTime(),
      icon: draft.icon,
      startsOn,
      endsOn: draft.endsOn,
      planHistory,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    })
  })
  return id
}

async function saveDayCheckInInDatabase(
  database: LifeOSDatabase,
  value: Omit<DayCheckIn, 'id' | 'updatedAt'>,
  now = new Date()
) {
  await database.transaction('rw', database.dayCheckIns, database.settings, async () => {
    const settings = await database.settings.get(DEFAULT_IDS.settings)
    if (!isDateKey(value.date)) throw new Error('A data do check-in é inválida.')
    if (value.date > todayKey(now, settings?.timezone)) throw new Error('Não é possível registrar um check-in em uma data futura.')
    await database.dayCheckIns.put({ ...value, id: value.date, updatedAt: now.toISOString() })
  })
}

async function addWaterInDatabase(database: LifeOSDatabase, date: string, amountMl: number, now = new Date()) {
  const roundedAmount = Math.round(amountMl)
  if (!Number.isFinite(roundedAmount) || roundedAmount < 1) throw new Error('Informe uma quantidade de água válida.')
  await database.transaction('rw', database.waterLogs, database.settings, database.habits, database.habitLogs, async () => {
    const settings = await database.settings.get(DEFAULT_IDS.settings)
    if (!isDateKey(date)) throw new Error('A data do registro de água é inválida.')
    if (date > todayKey(now, settings?.timezone)) throw new Error('Não é possível registrar água em uma data futura.')
    await database.waterLogs.add({ id: createId('water'), date, amountMl: roundedAmount, recordedAt: now.toISOString() })
    const habit = await database.habits.get(DEFAULT_IDS.habit.water)
    if (habit && isHabitDueOn(habit, date)) await applyHabitLog(database, habit.id, date, 'done', undefined, now)
  })
}

async function removeWaterInDatabase(database: LifeOSDatabase, id: string, now = new Date()) {
  await database.transaction('rw', database.waterLogs, database.settings, database.habits, database.habitLogs, async () => {
    const entry = await database.waterLogs.get(id)
    if (!entry) return
    await database.waterLogs.delete(id)
    const remaining = await database.waterLogs.where('date').equals(entry.date).count()
    const habit = await database.habits.get(DEFAULT_IDS.habit.water)
    if (!remaining && habit && isHabitDueOn(habit, entry.date)) await applyHabitLog(database, habit.id, entry.date, null, undefined, now)
  })
}

async function updateSettingsInDatabase(database: LifeOSDatabase, patch: Partial<LifeOSSettings>, now = new Date()) {
  await database.transaction('rw', database.settings, async () => {
    const current = (await database.settings.get(DEFAULT_IDS.settings)) ?? DEFAULT_SETTINGS
    if (patch.customCategories) validateCategories(patch.customCategories)
    const completion = { ...current.completion, ...patch.completion }
    if (![completion.excellentAt, completion.partialAt, completion.partialWeight].every(Number.isFinite) || completion.partialAt < 0 || completion.excellentAt > 100 || completion.excellentAt <= completion.partialAt || completion.partialWeight < 0 || completion.partialWeight > 1) throw new Error('Revise os limites de conclusão: excelente deve ser maior que parcial, entre 0 e 100%.')
    if (patch.waterGoalMl != null && (!Number.isFinite(patch.waterGoalMl) || patch.waterGoalMl <= 0)) throw new Error('A meta de água precisa ser maior que zero.')
    await database.settings.put({
      ...current,
      ...patch,
      completion,
      profile: { ...current.profile, ...patch.profile },
      appearance: { ...current.appearance, ...patch.appearance },
      sync: { ...current.sync, ...patch.sync },
      id: DEFAULT_IDS.settings,
      updatedAt: now.toISOString()
    })
  })
}

// Operacoes isoladas da camada React para testes de atomicidade e migracoes.
// eslint-disable-next-line react-refresh/only-export-components
export const lifeOSDataOperations = {
  setHabitLog: setHabitLogInDatabase,
  saveSleepLog: saveSleepLogInDatabase,
  saveHabit: saveHabitInDatabase,
  saveDayCheckIn: saveDayCheckInInDatabase,
  addWater: addWaterInDatabase,
  removeWater: removeWaterInDatabase,
  updateSettings: updateSettingsInDatabase,
}

export function LifeOSProvider({ children }: { children: ReactNode }) {
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    seedDatabaseIfNeeded()
      .then(() => active && setSeeded(true))
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o banco local.')
      })
    return () => { active = false }
  }, [])

  const habits = useLiveQuery(() => db.habits.orderBy('sortOrder').toArray(), [], [])
  const habitLogs = useLiveQuery(() => db.habitLogs.toArray(), [], [])
  const sleepLogs = useLiveQuery(() => db.sleepLogs.orderBy('date').reverse().toArray(), [], [])
  const dayCheckIns = useLiveQuery(() => db.dayCheckIns.toArray(), [], [])
  const waterLogs = useLiveQuery(() => db.waterLogs.toArray(), [], [])
  const scheduleItems = useLiveQuery(() => db.scheduleItems.toArray(), [], [])
  const moduleTasks = useLiveQuery(() => db.moduleTasks.toArray(), [], [])
  const therapyNotes = useLiveQuery(() => db.therapyNotes.orderBy('date').reverse().toArray(), [], [])
  const storedSettings = useLiveQuery(() => db.settings.get(DEFAULT_IDS.settings), [], undefined)

  const setHabitLog = useCallback(async (habitId: string, date: string, status: HabitLogStatus | null, note?: string) => {
    await setHabitLogInDatabase(db, habitId, date, status, note)
  }, [])

  const saveHabit = useCallback(async (draft: HabitDraft) => {
    return saveHabitInDatabase(db, draft)
  }, [])

  const removeHabit = useCallback(async (id: string) => {
    await db.transaction('rw', db.habits, db.habitLogs, async () => {
      await db.habitLogs.where('habitId').equals(id).delete()
      await db.habits.delete(id)
    })
  }, [])

  const saveSleepLog = useCallback(async (draft: SleepDraft) => {
    await saveSleepLogInDatabase(db, draft)
  }, [])

  const saveDayCheckIn = useCallback(async (value: Omit<DayCheckIn, 'id' | 'updatedAt'>) => {
    await saveDayCheckInInDatabase(db, value)
  }, [])

  const addWater = useCallback(async (date: string, amountMl: number) => {
    await addWaterInDatabase(db, date, amountMl)
  }, [])

  const removeWaterLog = useCallback(async (id: string) => removeWaterInDatabase(db, id), [])

  const saveTask = useCallback(async (draft: TaskDraft) => {
    const id = draft.id ?? createId('task')
    const existing = await db.moduleTasks.get(id)
    const timestamp = nowIso()
    await db.moduleTasks.put({
      id,
      module: draft.module,
      kind: draft.kind ?? existing?.kind,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      status: draft.status,
      priority: draft.priority,
      dueDate: draft.dueDate,
      progressPercent: draft.progressPercent == null ? undefined : Math.min(100, Math.max(0, draft.progressPercent)),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    })
    return id
  }, [])

  const removeTask = useCallback(async (id: string) => db.moduleTasks.delete(id), [])

  const saveScheduleItem = useCallback(async (draft: ScheduleDraft) => {
    const id = draft.id ?? createId('schedule')
    const existing = await db.scheduleItems.get(id)
    const timestamp = nowIso()
    await db.scheduleItems.put({
      id,
      title: draft.title.trim(),
      category: draft.category,
      recurrence: draft.recurrence,
      startTime: draft.startTime,
      endTime: draft.endTime,
      dayOffset: draft.dayOffset ?? existing?.dayOffset ?? 0,
      location: draft.location?.trim() || undefined,
      note: draft.note?.trim() || undefined,
      protectedTime: draft.protectedTime,
      active: draft.active ?? true,
      color: draft.color,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    })
    return id
  }, [])

  const removeScheduleItem = useCallback(async (id: string) => db.scheduleItems.delete(id), [])

  const saveTherapyNote = useCallback(async (draft: TherapyNoteDraft) => {
    const id = draft.id ?? createId('therapy-note')
    const existing = await db.therapyNotes.get(id)
    const timestamp = nowIso()
    await db.therapyNotes.put({
      id,
      date: draft.date,
      weekStart: draft.weekStart,
      authorRole: draft.authorRole ?? 'owner',
      content: draft.content.trim(),
      shared: draft.shared,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    })
    return id
  }, [])

  const removeTherapyNote = useCallback(async (id: string) => db.therapyNotes.delete(id), [])

  const updateSettings = useCallback(async (patch: Partial<LifeOSSettings>) => {
    await updateSettingsInDatabase(db, patch)
  }, [])

  const createBackup = useCallback(async (): Promise<LifeOSBackupV2> => {
    return db.transaction('r', [db.habits, db.habitLogs, db.sleepLogs, db.dayCheckIns, db.waterLogs, db.scheduleItems, db.moduleTasks, db.therapyNotes, db.settings, db.meta], async () => {
      const [habitsData, habitLogsData, sleepData, checkIns, water, schedule, tasks, notes, settingsData, metaData] = await Promise.all([
        db.habits.toArray(), db.habitLogs.toArray(), db.sleepLogs.toArray(), db.dayCheckIns.toArray(), db.waterLogs.toArray(),
        db.scheduleItems.toArray(), db.moduleTasks.toArray(), db.therapyNotes.toArray(), db.settings.toArray(), db.meta.toArray()
      ])
      return {
        format: 'lifeos-backup' as const,
        schemaVersion: 2 as const,
        exportedAt: nowIso(),
        data: {
          habits: habitsData,
          habitLogs: habitLogsData,
          sleepLogs: sleepData,
          dayCheckIns: checkIns,
          waterLogs: water,
          scheduleItems: schedule,
          moduleTasks: tasks,
          therapyNotes: notes,
          settings: settingsData,
          meta: metaData
        }
      }
    })
  }, [])

  const restoreBackup = useCallback(async (backup: LifeOSBackup) => {
    if (getShareConnection()) throw new Error('Revogue o link em Compartilhar antes de importar outro histórico.')
    await replaceDatabaseFromBackup(db, backup)
  }, [])

  const resetLocalData = useCallback(async () => {
    if (getShareConnection()) throw new Error('Revogue o link em Compartilhar antes de recomeçar a rotina.')
    await db.delete()
    await db.open()
    await seedDatabaseIfNeeded()
  }, [])

  const value = useMemo<LifeOSContextValue>(() => ({
    ready: seeded && Boolean(storedSettings), error, habits, habitLogs, sleepLogs, dayCheckIns, waterLogs, scheduleItems,
    moduleTasks, therapyNotes, settings: storedSettings ?? DEFAULT_SETTINGS, setHabitLog, saveHabit, removeHabit,
    saveSleepLog, saveDayCheckIn, addWater, removeWaterLog, saveTask, removeTask, saveScheduleItem, removeScheduleItem,
    saveTherapyNote, removeTherapyNote, updateSettings, createBackup, restoreBackup, resetLocalData
  }), [seeded, storedSettings, error, habits, habitLogs, sleepLogs, dayCheckIns, waterLogs, scheduleItems, moduleTasks, therapyNotes,
    setHabitLog, saveHabit, removeHabit, saveSleepLog, saveDayCheckIn, addWater, removeWaterLog, saveTask, removeTask,
    saveScheduleItem, removeScheduleItem, saveTherapyNote, removeTherapyNote, updateSettings, createBackup, restoreBackup, resetLocalData])

  return <LifeOSContext.Provider value={value}>{children}</LifeOSContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLifeOS() {
  const context = useContext(LifeOSContext)
  if (!context) throw new Error('useLifeOS precisa estar dentro de LifeOSProvider.')
  return context
}
