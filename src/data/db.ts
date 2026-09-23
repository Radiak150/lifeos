import Dexie, { type Table } from "dexie";

import type {
  DatabaseMeta,
  DayCheckIn,
  Habit,
  HabitLog,
  LifeOSSettings,
  ModuleTask,
  ScheduleItem,
  SleepLog,
  TherapyNote,
  WaterLog,
} from "../domain/types";
import { DEFAULT_COMPLETION_SETTINGS, xpAwardForStatus } from "../domain/metrics";
import { DEFAULT_SETTINGS } from "./defaults";
import { blankSettings } from "./starter";

const DATABASE_NAME = "lifeos";
export const CURRENT_SEED_VERSION = 4;

export class LifeOSDatabase extends Dexie {
  habits!: Table<Habit, string>;
  habitLogs!: Table<HabitLog, string>;
  sleepLogs!: Table<SleepLog, string>;
  dayCheckIns!: Table<DayCheckIn, string>;
  waterLogs!: Table<WaterLog, string>;
  scheduleItems!: Table<ScheduleItem, string>;
  moduleTasks!: Table<ModuleTask, string>;
  therapyNotes!: Table<TherapyNote, string>;
  settings!: Table<LifeOSSettings, string>;
  meta!: Table<DatabaseMeta, string>;

  constructor(name = DATABASE_NAME) {
    super(name);

    this.version(1).stores({
      habits: "id, status, category, phaseId, startsOn, sortOrder",
      habitLogs: "id, habitId, date, &[habitId+date], status",
      sleepLogs: "id, date, sleepStartedAt",
      dayCheckIns: "id, date",
      waterLogs: "id, date, recordedAt",
      scheduleItems: "id, category, active",
      moduleTasks: "id, module, status, dueDate",
      therapyNotes: "id, date, weekStart, authorRole, shared",
      settings: "id",
      meta: "id, seedVersion",
    });

    // A deduplicacao precisa ocorrer antes da criacao dos indices unicos. O
    // IndexedDB cria indices antes de executar `.upgrade()`, portanto usamos
    // uma versao intermediaria sem alterar o schema e a versao seguinte aplica
    // `&date` somente depois que os conflitos legados foram removidos.
    this.version(2)
      .stores({
        habits: "id, status, category, phaseId, startsOn, sortOrder",
        habitLogs: "id, habitId, date, &[habitId+date], status",
        sleepLogs: "id, date, sleepStartedAt",
        dayCheckIns: "id, date",
        waterLogs: "id, date, recordedAt",
        scheduleItems: "id, category, active",
        moduleTasks: "id, module, status, dueDate",
        therapyNotes: "id, date, weekStart, authorRole, shared",
        settings: "id",
        meta: "id, seedVersion",
      })
      .upgrade(async (transaction) => {
        const habitsTable = transaction.table<Habit, string>("habits");
        const habitLogsTable = transaction.table<HabitLog, string>("habitLogs");
        const settingsTable = transaction.table<LifeOSSettings, string>("settings");
        const metaTable = transaction.table<DatabaseMeta, string>("meta");
        const sleepTable = transaction.table<SleepLog, string>("sleepLogs");
        const checkInTable = transaction.table<DayCheckIn, string>("dayCheckIns");
        const settings = await settingsTable.get(DEFAULT_SETTINGS.id);
        const partialWeight = settings?.completion?.partialWeight ?? DEFAULT_COMPLETION_SETTINGS.partialWeight;
        const habits = await habitsTable.toArray();

        const deduplicateByDate = async <T extends { id: string; date: string }>(
          table: Table<T, string>,
          timestampOf: (entry: T) => string,
          canonicalId: (entry: T) => string,
        ) => {
          const entries = await table.toArray();
          const winnerByDate = new Map<string, T>();
          for (const entry of entries) {
            const winner = winnerByDate.get(entry.date);
            if (!winner || timestampOf(entry) > timestampOf(winner) ||
              (timestampOf(entry) === timestampOf(winner) && entry.id > winner.id)) {
              winnerByDate.set(entry.date, entry);
            }
          }
          const normalized = [...winnerByDate.values()].map((entry) => ({
            ...entry,
            id: canonicalId(entry),
          }));
          await table.clear();
          if (normalized.length) await table.bulkPut(normalized);
        };

        await deduplicateByDate(sleepTable, (entry) => entry.updatedAt ?? entry.sleepStartedAt, (entry) => `sleep-log:${entry.date}`);
        await deduplicateByDate(checkInTable, (entry) => entry.updatedAt ?? "", (entry) => entry.date);

        for (const habit of habits) {
          const effectiveFrom = habit.startsOn ?? habit.createdAt?.slice(0, 10);
          if (!habit.planHistory?.length && effectiveFrom) {
            await habitsTable.update(habit.id, {
              planHistory: [{
                effectiveFrom,
                status: habit.status,
                frequency: habit.frequency,
                phaseId: habit.phaseId,
                startsOn: habit.startsOn,
                endsOn: habit.endsOn,
              }],
            });
          }
        }

        const rewardByHabit = new Map(habits.map((habit) => [habit.id, habit.xpReward]));
        const logs = await habitLogsTable.toArray();
        for (const log of logs) {
          if (log.xpAwarded == null) {
            await habitLogsTable.update(log.id, {
              xpAwarded: xpAwardForStatus(log.status, rewardByHabit.get(log.habitId) ?? 0, partialWeight),
            });
          }
        }

        for (const habit of habits) {
          const currentLogs = await habitLogsTable.where("habitId").equals(habit.id).toArray();
          const currentXp = currentLogs.reduce((total, log) => total + (log.xpAwarded ?? 0), 0);
          await habitsTable.update(habit.id, {
            currentXp,
            level: Math.floor(currentXp / 100) + 1,
          });
        }

        const meta = await metaTable.get("database-meta");
        if (meta) await metaTable.update(meta.id, { bootstrapCompleted: true });
      });

    this.version(3).stores({
      habits: "id, status, category, phaseId, startsOn, sortOrder",
      habitLogs: "id, habitId, date, &[habitId+date], status",
      sleepLogs: "id, &date, sleepStartedAt",
      dayCheckIns: "id, &date",
      waterLogs: "id, date, recordedAt",
      scheduleItems: "id, category, active",
      moduleTasks: "id, module, status, dueDate",
      therapyNotes: "id, date, weekStart, authorRole, shared",
      settings: "id",
      meta: "id, seedVersion",
    });
  }
}

export const db = new LifeOSDatabase();

/** Inicializa apenas configurações. Atualizações nunca substituem os dados existentes. */
export async function seedDatabaseIfNeeded(database: LifeOSDatabase = db): Promise<void> {
  await database.transaction("rw", database.settings, database.meta, async () => {
    const current = await database.settings.get(DEFAULT_SETTINGS.id);
    if (!current) await database.settings.add(blankSettings());
    const meta = await database.meta.get("database-meta");
    if (!meta?.bootstrapCompleted || meta.seedVersion < CURRENT_SEED_VERSION) {
      await database.meta.put({ id: "database-meta", seedVersion: CURRENT_SEED_VERSION,
        seededAt: meta?.seededAt ?? new Date().toISOString(), bootstrapCompleted: true });
    }
  });
}

export const makeHabitLogId = (habitId: string, date: string): string =>
  `habit-log:${habitId}:${date}`;

export const makeSleepLogId = (date: string): string => `sleep-log:${date}`;
