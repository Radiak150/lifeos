import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { lifeOSDataOperations } from '../app/LifeOSProvider'
import { DEFAULT_IDS, DEFAULT_HABITS, DEFAULT_SETTINGS } from './defaults'
import { SYNTHETIC_MODULE_TASKS, SYNTHETIC_PROFILE, SYNTHETIC_SCHEDULE_ITEMS } from '../test/fixtures/routine'
import { normalizeAndValidateBackup, replaceDatabaseFromBackup, type LifeOSBackupV2 } from './backup'
import { LifeOSDatabase, seedDatabaseIfNeeded } from './db'

async function withDatabase(run: (database: LifeOSDatabase) => Promise<void>) {
  const database = new LifeOSDatabase(`lifeos-backup-test:${crypto.randomUUID()}`)
  await database.open()
  await seedDatabaseIfNeeded(database)
  await database.settings.put(structuredClone(DEFAULT_SETTINGS))
  await database.habits.bulkPut(structuredClone(DEFAULT_HABITS.map(h => ({ ...h, planHistory: [{ effectiveFrom: h.startsOn ?? h.createdAt.slice(0,10), startsOn: h.startsOn, endsOn: h.endsOn, frequency: h.frequency, status: h.status, phaseId: h.phaseId }] }))))
  await database.scheduleItems.bulkPut(structuredClone([...SYNTHETIC_SCHEDULE_ITEMS]))
  await database.moduleTasks.bulkPut(structuredClone([...SYNTHETIC_MODULE_TASKS]))
  try { await run(database) } finally { await database.delete() }
}

async function snapshot(database: LifeOSDatabase): Promise<LifeOSBackupV2> {
  const [habits, habitLogs, sleepLogs, dayCheckIns, waterLogs, scheduleItems, moduleTasks, therapyNotes, settings, meta] = await Promise.all([
    database.habits.toArray(), database.habitLogs.toArray(), database.sleepLogs.toArray(), database.dayCheckIns.toArray(), database.waterLogs.toArray(),
    database.scheduleItems.toArray(), database.moduleTasks.toArray(), database.therapyNotes.toArray(), database.settings.toArray(), database.meta.toArray()
  ])
  return { format: 'lifeos-backup', schemaVersion: 2, exportedAt: new Date().toISOString(), data: { habits, habitLogs, sleepLogs, dayCheckIns, waterLogs, scheduleItems, moduleTasks, therapyNotes, settings, meta } }
}

describe('operações locais críticas', () => {
  it.each([{}, { displayName: 'Pessoa de teste' }, SYNTHETIC_PROFILE])('migra perfil v1 sem inserir dados pessoais de terceiros: %j', async profile => {
    await withDatabase(async database => {
      const backup = await snapshot(database)
      const legacy = { ...backup, schemaVersion: 1, data: { ...backup.data, settings: [{ ...backup.data.settings[0], profile }] } }
      await replaceDatabaseFromBackup(database, legacy)
      expect((await database.settings.get(DEFAULT_IDS.settings))?.profile).toEqual({ displayName: '', hasCat: false, ...profile })
      expect(await database.scheduleItems.toArray()).toEqual(backup.data.scheduleItems)
      expect(await database.moduleTasks.toArray()).toEqual(SYNTHETIC_MODULE_TASKS)
    })
  })

  it('migra um banco v1 com datas duplicadas e mantém o registro mais novo', async () => {
    const name = `lifeos-migration-test:${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({
      habits: 'id, status, category, phaseId, startsOn, sortOrder',
      habitLogs: 'id, habitId, date, &[habitId+date], status',
      sleepLogs: 'id, date, sleepStartedAt', dayCheckIns: 'id, date', waterLogs: 'id, date, recordedAt',
      scheduleItems: 'id, category, active', moduleTasks: 'id, module, status, dueDate',
      therapyNotes: 'id, date, weekStart, authorRole, shared', settings: 'id', meta: 'id, seedVersion'
    })
    await legacy.open()
    await legacy.table('sleepLogs').bulkAdd([
      { id: 'old', date: '2026-08-12', sleepStartedAt: '2026-08-11T23:00:00Z', updatedAt: '2026-08-12T08:00:00Z' },
      { id: 'new', date: '2026-08-12', sleepStartedAt: '2026-08-12T01:00:00Z', updatedAt: '2026-08-12T09:00:00Z' }
    ])
    await legacy.close()

    const upgraded = new LifeOSDatabase(name)
    await upgraded.open()
    try {
      expect(await upgraded.sleepLogs.count()).toBe(1)
      const migrated = await upgraded.sleepLogs.where('date').equals('2026-08-12').first()
      expect(migrated?.id).toBe('sleep-log:2026-08-12')
      expect(migrated?.sleepStartedAt).toBe('2026-08-12T01:00:00Z')
      await expect(upgraded.sleepLogs.add({ id: 'duplicate', date: '2026-08-12', sleepStartedAt: '2026-08-12T02:00:00Z', createdAt: '2026-08-12T02:00:00Z', updatedAt: '2026-08-12T02:00:00Z' })).rejects.toBeTruthy()
    } finally {
      await upgraded.delete()
    }
  })

  it('persiste log e XP atomicamente e congela a recompensa concedida', async () => {
    await withDatabase(async (database) => {
      const date = '2026-08-12'
      const now = new Date('2026-08-12T15:00:00Z')
      await lifeOSDataOperations.setHabitLog(database, DEFAULT_IDS.habit.brushTeethMorning, date, 'done', undefined, now)
      const first = await database.habitLogs.get(`habit-log:${DEFAULT_IDS.habit.brushTeethMorning}:${date}`)
      expect(first?.xpAwarded).toBe(10)

      await database.habits.update(DEFAULT_IDS.habit.brushTeethMorning, { xpReward: 30 })
      await lifeOSDataOperations.setHabitLog(database, DEFAULT_IDS.habit.brushTeethMorning, date, null, undefined, now)
      expect((await database.habits.get(DEFAULT_IDS.habit.brushTeethMorning))?.currentXp).toBe(0)
    })
  })

  it('obriga o hábito de sono a vir de um registro real e rejeita futuro', async () => {
    await withDatabase(async (database) => {
      const now = new Date('2026-08-12T15:00:00Z')
      await expect(lifeOSDataOperations.setHabitLog(database, DEFAULT_IDS.habit.registerSleep, '2026-08-12', 'done', undefined, now)).rejects.toThrow(/registro de sono/i)
      await expect(lifeOSDataOperations.saveSleepLog(database, { date: '2026-08-13', sleepStartedAt: '2026-08-13T01:00:00Z' }, now)).rejects.toThrow(/futur/i)
      await expect(lifeOSDataOperations.saveSleepLog(database, { date: '2026-08-12', sleepStartedAt: '2026-08-12T16:00:00Z' }, now)).rejects.toThrow(/futuro/i)
      await expect(lifeOSDataOperations.saveSleepLog(database, { date: '2026-08-12', sleepStartedAt: 'data-invalida' }, now)).rejects.toThrow(/inválido/i)
      expect(await database.sleepLogs.count()).toBe(0)
      expect(await database.habitLogs.count()).toBe(0)
    })
  })

  it('rejeita backup órfão antes de qualquer escrita', async () => {
    await withDatabase(async (database) => {
      const habits = await database.habits.toArray()
      const settings = await database.settings.toArray()
      const meta = await database.meta.toArray()
      const backup = {
        format: 'lifeos-backup', schemaVersion: 2, exportedAt: new Date().toISOString(),
        data: {
          habits, settings, meta, sleepLogs: [], dayCheckIns: [], waterLogs: [], scheduleItems: [], moduleTasks: [], therapyNotes: [],
          habitLogs: [{ id: 'habit-log:missing:2026-08-12', habitId: 'missing', date: '2026-08-12', status: 'done', xpAwarded: 10, updatedAt: new Date().toISOString() }]
        }
      }
      expect(() => normalizeAndValidateBackup(backup)).toThrow(/inexistente/i)
      expect(await database.habits.count()).toBe(habits.length)
    })
  })

  it('restaura um snapshot exato sem ressuscitar defaults excluídos', async () => {
    await withDatabase(async (database) => {
      await database.habits.delete(DEFAULT_IDS.habit.brushTeethMorning)
      const backup = await snapshot(database)
      await database.habits.delete(DEFAULT_IDS.habit.water)
      await database.settings.update(DEFAULT_IDS.settings, { waterGoalMl: 999 })

      await replaceDatabaseFromBackup(database, backup)
      expect(await database.habits.get(DEFAULT_IDS.habit.brushTeethMorning)).toBeUndefined()
      expect(await database.habits.get(DEFAULT_IDS.habit.water)).toBeDefined()
      expect(await database.scheduleItems.toArray()).toEqual(backup.data.scheduleItems)
      expect(await database.moduleTasks.toArray()).toEqual(backup.data.moduleTasks)
      expect((await database.settings.get(DEFAULT_IDS.settings))?.waterGoalMl).toBe(800)
      expect((await database.meta.get('database-meta'))?.bootstrapCompleted).toBe(true)
    })
  })

  it('preserva o banco quando a restauração falha na validação', async () => {
    await withDatabase(async (database) => {
      const before = await snapshot(database)
      const invalid = structuredClone(before)
      invalid.data.settings[0].waterGoalMl = 0
      await expect(replaceDatabaseFromBackup(database, invalid)).rejects.toThrow(/waterGoalMl/i)
      expect(await database.habits.count()).toBe(before.data.habits.length)
      expect((await database.settings.get(DEFAULT_IDS.settings))?.waterGoalMl).toBe(800)
    })
  })
})
