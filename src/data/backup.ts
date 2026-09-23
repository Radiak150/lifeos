import { validateCategories } from "../domain/categories";
import { DEFAULT_SETTINGS } from "./defaults";
import { CURRENT_SEED_VERSION, type LifeOSDatabase } from "./db";
import { isDateKey } from "../domain/date";
import { xpAwardForStatus } from "../domain/metrics";
import type {
  DatabaseMeta,
  DayCheckIn,
  Habit,
  HabitFrequency,
  HabitLog,
  HabitPlanVersion,
  LifeOSSettings,
  ModuleTask,
  ScheduleItem,
  SleepLog,
  TherapyNote,
  WaterLog,
} from "../domain/types";

export type LifeOSBackupData = {
  habits: Habit[];
  habitLogs: HabitLog[];
  sleepLogs: SleepLog[];
  dayCheckIns: DayCheckIn[];
  waterLogs: WaterLog[];
  scheduleItems: ScheduleItem[];
  moduleTasks: ModuleTask[];
  therapyNotes: TherapyNote[];
  settings: LifeOSSettings[];
  meta: DatabaseMeta[];
};

export type LifeOSBackupV2 = {
  format: "lifeos-backup";
  schemaVersion: 2;
  exportedAt: string;
  data: LifeOSBackupData;
};

export type LifeOSBackupV1 = Omit<LifeOSBackupV2, "schemaVersion" | "data"> & {
  schemaVersion: 1;
  data: Omit<LifeOSBackupData, "meta">;
};

export type LifeOSBackup = LifeOSBackupV1 | LifeOSBackupV2;

const HABIT_STATUSES = new Set(["active", "consolidated", "trial", "future", "paused"]);
const LOG_STATUSES = new Set(["done", "partial", "missed", "skipped"]);
const LIFE_AREAS = new Set([
  "hygiene", "pets", "morning", "health", "sleep", "home", "fitness", "exercise", "relationship",
  "college", "fushi", "work", "therapy", "personal", "other",
]);
const MODULES = new Set(["pets", "college", "fushi", "home", "relationship", "work", "fitness"]);
const TASK_STATUSES = new Set(["backlog", "planned", "in-progress", "done", "paused"]);
const TASK_PRIORITIES = new Set(["low", "medium", "high"]);

function fail(path: string, message: string): never {
  throw new Error(`Backup invalido em ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "objeto esperado");
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "lista esperada");
  return value;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) fail(path, "texto esperado");
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value == null ? undefined : string(value, path, true);
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "numero finito esperado");
  return value;
}

function integer(value: unknown, path: string, minimum?: number, maximum?: number): number {
  const parsed = finiteNumber(value, path);
  if (!Number.isInteger(parsed) || (minimum != null && parsed < minimum) || (maximum != null && parsed > maximum)) {
    fail(path, "inteiro fora do intervalo permitido");
  }
  return parsed;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "booleano esperado");
  return value;
}

function dateKey(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!isDateKey(parsed)) fail(path, "data deve usar yyyy-MM-dd");
  return parsed;
}

function optionalDateKey(value: unknown, path: string): string | undefined {
  return value == null ? undefined : dateKey(value, path);
}

function isoDate(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!Number.isFinite(Date.parse(parsed))) fail(path, "instante ISO 8601 invalido");
  return parsed;
}

function optionalIsoDate(value: unknown, path: string): string | undefined {
  return value == null ? undefined : isoDate(value, path);
}

function enumValue(value: unknown, allowed: Set<string>, path: string): string {
  const parsed = string(value, path);
  if (!allowed.has(parsed)) fail(path, `valor nao permitido: ${parsed}`);
  return parsed;
}

function areaValue(value: unknown, allowed: Set<string>, path: string): string {
  if (typeof value === "string" && /^custom:[a-zA-Z0-9-]{1,80}$/.test(value)) return value;
  return enumValue(value, allowed, path);
}

function weekdays(value: unknown, path: string): number[] {
  const result = array(value, path).map((day, index) => integer(day, `${path}[${index}]`, 0, 6));
  if (new Set(result).size !== result.length) fail(path, "dias da semana duplicados");
  return result;
}

function validateFrequency(value: unknown, path: string): HabitFrequency {
  const item = record(value, path);
  const type = string(item.type, `${path}.type`);
  if (type === "daily" || type === "unscheduled") return item as unknown as HabitFrequency;
  if (type === "weekdays") {
    weekdays(item.weekdays, `${path}.weekdays`);
    return item as unknown as HabitFrequency;
  }
  if (type === "interval") {
    integer(item.everyDays, `${path}.everyDays`, 1);
    dateKey(item.anchorDate, `${path}.anchorDate`);
    return item as unknown as HabitFrequency;
  }
  if (type === "weekly-target") {
    integer(item.target, `${path}.target`, 1, 7);
    if (item.preferredWeekdays != null) weekdays(item.preferredWeekdays, `${path}.preferredWeekdays`);
    return item as unknown as HabitFrequency;
  }
  return fail(`${path}.type`, "tipo de frequencia desconhecido");
}

function validatePlan(value: unknown, path: string): HabitPlanVersion {
  const plan = record(value, path);
  const startsOn = optionalDateKey(plan.startsOn, `${path}.startsOn`);
  const endsOn = optionalDateKey(plan.endsOn, `${path}.endsOn`);
  if (startsOn && endsOn && startsOn > endsOn) fail(path, "startsOn vem depois de endsOn");
  dateKey(plan.effectiveFrom, `${path}.effectiveFrom`);
  enumValue(plan.status, HABIT_STATUSES, `${path}.status`);
  validateFrequency(plan.frequency, `${path}.frequency`);
  string(plan.phaseId, `${path}.phaseId`);
  return plan as unknown as HabitPlanVersion;
}

function validateHabit(value: unknown, path: string, requireV2Fields: boolean): Habit {
  const habit = record(value, path);
  string(habit.id, `${path}.id`);
  string(habit.name, `${path}.name`);
  areaValue(habit.category, LIFE_AREAS, `${path}.category`);
  string(habit.objective, `${path}.objective`, true);
  string(habit.minimumVersion, `${path}.minimumVersion`);
  validateFrequency(habit.frequency, `${path}.frequency`);
  enumValue(habit.status, HABIT_STATUSES, `${path}.status`);
  string(habit.phaseId, `${path}.phaseId`);
  finiteNumber(habit.xpReward, `${path}.xpReward`);
  integer(habit.level, `${path}.level`, 1);
  integer(habit.currentXp, `${path}.currentXp`, 0);
  finiteNumber(habit.sortOrder, `${path}.sortOrder`);
  optionalString(habit.icon, `${path}.icon`);
  const startsOn = optionalDateKey(habit.startsOn, `${path}.startsOn`);
  const endsOn = optionalDateKey(habit.endsOn, `${path}.endsOn`);
  if (startsOn && endsOn && startsOn > endsOn) fail(path, "startsOn vem depois de endsOn");
  isoDate(habit.createdAt, `${path}.createdAt`);
  isoDate(habit.updatedAt, `${path}.updatedAt`);
  if (habit.planHistory != null) {
    const plans = array(habit.planHistory, `${path}.planHistory`).map((plan, index) => validatePlan(plan, `${path}.planHistory[${index}]`));
    if (!plans.length) fail(`${path}.planHistory`, "historico vazio");
    for (let index = 1; index < plans.length; index += 1) {
      if (plans[index - 1].effectiveFrom >= plans[index].effectiveFrom) {
        fail(`${path}.planHistory`, "effectiveFrom deve ser unico e crescente");
      }
    }
  } else if (requireV2Fields) {
    fail(`${path}.planHistory`, "campo obrigatorio no backup v2");
  }
  return habit as unknown as Habit;
}

function validateHabitLog(value: unknown, path: string, requireV2Fields: boolean): HabitLog {
  const log = record(value, path);
  const id = string(log.id, `${path}.id`);
  const habitId = string(log.habitId, `${path}.habitId`);
  const date = dateKey(log.date, `${path}.date`);
  if (id !== `habit-log:${habitId}:${date}`) fail(`${path}.id`, "ID nao corresponde ao habito e data");
  enumValue(log.status, LOG_STATUSES, `${path}.status`);
  optionalString(log.note, `${path}.note`);
  if (log.xpAwarded != null) integer(log.xpAwarded, `${path}.xpAwarded`, 0);
  else if (requireV2Fields) fail(`${path}.xpAwarded`, "campo obrigatorio no backup v2");
  optionalIsoDate(log.completedAt, `${path}.completedAt`);
  isoDate(log.updatedAt, `${path}.updatedAt`);
  return log as unknown as HabitLog;
}

function validateSleep(value: unknown, path: string): SleepLog {
  const log = record(value, path);
  const id = string(log.id, `${path}.id`);
  const date = dateKey(log.date, `${path}.date`);
  if (id !== `sleep-log:${date}`) fail(`${path}.id`, "ID nao corresponde a data");
  isoDate(log.sleepStartedAt, `${path}.sleepStartedAt`);
  const wokeAt = optionalIsoDate(log.wokeAt, `${path}.wokeAt`);
  if (wokeAt && Date.parse(wokeAt) < Date.parse(log.sleepStartedAt as string)) fail(path, "despertar anterior ao inicio");
  if (log.durationMinutes != null) integer(log.durationMinutes, `${path}.durationMinutes`, 0);
  if (log.quality != null) integer(log.quality, `${path}.quality`, 1, 5);
  if (log.interruptions != null) integer(log.interruptions, `${path}.interruptions`, 0);
  optionalString(log.note, `${path}.note`);
  isoDate(log.createdAt, `${path}.createdAt`);
  isoDate(log.updatedAt, `${path}.updatedAt`);
  return log as unknown as SleepLog;
}

function validateCheckIn(value: unknown, path: string): DayCheckIn {
  const entry = record(value, path);
  const id = dateKey(entry.id, `${path}.id`);
  const date = dateKey(entry.date, `${path}.date`);
  if (id !== date) fail(`${path}.id`, "ID precisa ser a propria data");
  for (const key of ["energy", "overload", "difficulty", "mood"] as const) {
    if (entry[key] != null) integer(entry[key], `${path}.${key}`, 1, 5);
  }
  if (entry.difficultDay != null) boolean(entry.difficultDay, `${path}.difficultDay`);
  optionalString(entry.note, `${path}.note`);
  isoDate(entry.updatedAt, `${path}.updatedAt`);
  return entry as unknown as DayCheckIn;
}

function validateWater(value: unknown, path: string): WaterLog {
  const entry = record(value, path);
  string(entry.id, `${path}.id`);
  dateKey(entry.date, `${path}.date`);
  integer(entry.amountMl, `${path}.amountMl`, 1);
  isoDate(entry.recordedAt, `${path}.recordedAt`);
  return entry as unknown as WaterLog;
}

function time(value: unknown, path: string): string {
  const parsed = string(value, path);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed)) fail(path, "horario deve usar HH:mm");
  return parsed;
}

function validateSchedule(value: unknown, path: string): ScheduleItem {
  const item = record(value, path);
  string(item.id, `${path}.id`);
  string(item.title, `${path}.title`);
  areaValue(item.category, LIFE_AREAS, `${path}.category`);
  const recurrence = record(item.recurrence, `${path}.recurrence`);
  const recurrenceType = string(recurrence.type, `${path}.recurrence.type`);
  if (recurrenceType === "weekly") weekdays(recurrence.weekdays, `${path}.recurrence.weekdays`);
  else if (recurrenceType === "one-off") dateKey(recurrence.date, `${path}.recurrence.date`);
  else if (recurrenceType !== "daily") fail(`${path}.recurrence.type`, "recorrencia desconhecida");
  const start = time(item.startTime, `${path}.startTime`);
  const end = item.endTime == null ? undefined : time(item.endTime, `${path}.endTime`);
  if (end && end === start) fail(path, "inicio e fim nao podem ser iguais");
  if (item.dayOffset != null && item.dayOffset !== 0 && item.dayOffset !== 1) fail(path, "deslocamento de dia invalido");
  optionalString(item.location, `${path}.location`);
  optionalString(item.note, `${path}.note`);
  boolean(item.protectedTime, `${path}.protectedTime`);
  boolean(item.active, `${path}.active`);
  optionalString(item.color, `${path}.color`);
  isoDate(item.createdAt, `${path}.createdAt`);
  isoDate(item.updatedAt, `${path}.updatedAt`);
  return item as unknown as ScheduleItem;
}

function validateTask(value: unknown, path: string): ModuleTask {
  const task = record(value, path);
  string(task.id, `${path}.id`);
  areaValue(task.module, MODULES, `${path}.module`);
  if (task.kind != null) enumValue(task.kind, new Set(['task', 'bug', 'content', 'session', 'study', 'training']), `${path}.kind`);
  string(task.title, `${path}.title`);
  optionalString(task.description, `${path}.description`);
  enumValue(task.status, TASK_STATUSES, `${path}.status`);
  if (task.priority != null) enumValue(task.priority, TASK_PRIORITIES, `${path}.priority`);
  optionalDateKey(task.dueDate, `${path}.dueDate`);
  if (task.progressPercent != null) finiteNumber(task.progressPercent, `${path}.progressPercent`);
  isoDate(task.createdAt, `${path}.createdAt`);
  isoDate(task.updatedAt, `${path}.updatedAt`);
  return task as unknown as ModuleTask;
}

function validateTherapyNote(value: unknown, path: string): TherapyNote {
  const note = record(value, path);
  string(note.id, `${path}.id`);
  dateKey(note.date, `${path}.date`);
  optionalDateKey(note.weekStart, `${path}.weekStart`);
  enumValue(note.authorRole, new Set(["owner", "therapist"]), `${path}.authorRole`);
  string(note.content, `${path}.content`);
  boolean(note.shared, `${path}.shared`);
  isoDate(note.createdAt, `${path}.createdAt`);
  isoDate(note.updatedAt, `${path}.updatedAt`);
  return note as unknown as TherapyNote;
}

function validateSettings(value: unknown, path: string): LifeOSSettings {
  const settings = record(value, path);
  if (settings.id !== "lifeos-settings") fail(`${path}.id`, "ID de configuracao invalido");
  integer(settings.schemaVersion, `${path}.schemaVersion`, 1, 1);
  const timezone = string(settings.timezone, `${path}.timezone`);
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(new Date()); }
  catch { fail(`${path}.timezone`, "fuso IANA invalido"); }
  integer(settings.weekStartsOn, `${path}.weekStartsOn`, 0, 6);
  const completion = record(settings.completion, `${path}.completion`);
  const excellentAt = integer(completion.excellentAt, `${path}.completion.excellentAt`, 1, 100);
  const partialAt = integer(completion.partialAt, `${path}.completion.partialAt`, 0, 99);
  if (partialAt >= excellentAt) fail(`${path}.completion`, "limites parcial/excelente invertidos");
  const partialWeight = finiteNumber(completion.partialWeight, `${path}.completion.partialWeight`);
  if (partialWeight < 0 || partialWeight > 1) fail(`${path}.completion.partialWeight`, "peso fora de 0..1");
  enumValue(completion.skippedHabitPolicy, new Set(["exclude", "count-as-missed"]), `${path}.completion.skippedHabitPolicy`);
  string(settings.activePhaseId, `${path}.activePhaseId`);
  integer(settings.waterGoalMl, `${path}.waterGoalMl`, 1);
  const enabled = array(settings.enabledModules, `${path}.enabledModules`).map((module, index) => areaValue(module, MODULES, `${path}.enabledModules[${index}]`));
  if (new Set(enabled).size !== enabled.length) fail(`${path}.enabledModules`, "modulos duplicados");
  if (settings.customCategories != null) validateCategories(settings.customCategories);
  if (settings.onboarding != null) {
    const onboarding = record(settings.onboarding, `${path}.onboarding`);
    boolean(onboarding.completed, `${path}.onboarding.completed`);
    integer(onboarding.version, `${path}.onboarding.version`, 1, 1);
    optionalIsoDate(onboarding.completedAt, `${path}.onboarding.completedAt`);
  }
  const profile = record(settings.profile, `${path}.profile`);
  string(profile.displayName, `${path}.profile.displayName`, true);
  if (typeof profile.hasCat !== "boolean") fail(`${path}.profile.hasCat`, "booleano esperado");
  for (const key of ["age", "heightCm", "weightKg", "partnerAge", "partnerHeightCm", "partnerWeightKg"] as const) {
    if (profile[key] != null && finiteNumber(profile[key], `${path}.profile.${key}`) < 0) fail(`${path}.profile.${key}`, "valor negativo");
  }
  for (const key of ["occupation", "employer", "client", "college", "degree"] as const) optionalString(profile[key], `${path}.profile.${key}`);
  const appearance = record(settings.appearance, `${path}.appearance`);
  if (appearance.theme !== undefined) enumValue(appearance.theme, new Set(["light", "dark", "system"]), `${path}.appearance.theme`);
  enumValue(appearance.density, new Set(["comfortable", "compact"]), `${path}.appearance.density`);
  if (![0.9, 1, 1.1, 1.2].includes(finiteNumber(appearance.fontScale, `${path}.appearance.fontScale`))) fail(`${path}.appearance.fontScale`, "escala nao permitida");
  for (const key of ["reduceMotion", "highContrast", "focusMode"] as const) boolean(appearance[key], `${path}.appearance.${key}`);
  const sync = record(settings.sync, `${path}.sync`);
  enumValue(sync.provider, new Set(["local", "supabase"]), `${path}.sync.provider`);
  for (const key of ["projectUrl", "anonKey", "workspaceId"] as const) optionalString(sync[key], `${path}.sync.${key}`);
  optionalIsoDate(sync.lastSyncedAt, `${path}.sync.lastSyncedAt`);
  isoDate(settings.createdAt, `${path}.createdAt`);
  isoDate(settings.updatedAt, `${path}.updatedAt`);
  return settings as unknown as LifeOSSettings;
}

function validateMeta(value: unknown, path: string): DatabaseMeta {
  const meta = record(value, path);
  if (meta.id !== "database-meta") fail(`${path}.id`, "ID de metadados invalido");
  integer(meta.seedVersion, `${path}.seedVersion`, 0);
  isoDate(meta.seededAt, `${path}.seededAt`);
  if (meta.bootstrapCompleted !== true) fail(`${path}.bootstrapCompleted`, "bootstrap precisa estar concluido");
  return meta as unknown as DatabaseMeta;
}

function assertUnique<T>(items: readonly T[], key: (item: T) => string, path: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) fail(path, `chave duplicada: ${value}`);
    seen.add(value);
  }
}

function migrateV1(rawData: Record<string, unknown>, exportedAt: string): LifeOSBackupData {
  const settingsInput = array(rawData.settings, "data.settings");
  if (settingsInput.length !== 1) fail("data.settings", "backup v1 precisa conter exatamente uma configuracao");
  const migratedSettings = settingsInput.map((value) => {
    const current = record(value, "data.settings[]");
    return {
      ...DEFAULT_SETTINGS,
      ...current,
      completion: { ...DEFAULT_SETTINGS.completion, ...record(current.completion ?? {}, "data.settings[].completion") },
      profile: { ...DEFAULT_SETTINGS.profile, ...record(current.profile ?? {}, "data.settings[].profile") },
      appearance: { ...DEFAULT_SETTINGS.appearance, ...record(current.appearance ?? {}, "data.settings[].appearance") },
      sync: { ...DEFAULT_SETTINGS.sync, ...record(current.sync ?? {}, "data.settings[].sync") },
    } as LifeOSSettings;
  });
  const settings = migratedSettings[0];
  const habits = array(rawData.habits, "data.habits").map((value) => {
    const habit = structuredClone(value) as Habit;
    if (!habit.planHistory?.length) {
      habit.planHistory = [{
        effectiveFrom: habit.startsOn ?? habit.createdAt?.slice(0, 10),
        status: habit.status,
        frequency: habit.frequency,
        phaseId: habit.phaseId,
        startsOn: habit.startsOn,
        endsOn: habit.endsOn,
      }];
    }
    return habit;
  });
  const habitsById = new Map(habits.map((habit) => [habit.id, habit]));
  const habitLogs = array(rawData.habitLogs, "data.habitLogs").map((value) => {
    const log = structuredClone(value) as HabitLog;
    if (log.xpAwarded == null) {
      log.xpAwarded = xpAwardForStatus(log.status, habitsById.get(log.habitId)?.xpReward ?? 0, settings.completion.partialWeight);
    }
    return log;
  });
  for (const habit of habits) {
    const currentXp = habitLogs.filter((log) => log.habitId === habit.id).reduce((sum, log) => sum + (log.xpAwarded ?? 0), 0);
    habit.currentXp = currentXp;
    habit.level = Math.floor(currentXp / 100) + 1;
  }

  const dedupe = <T extends { id: string; date: string }>(
    items: T[],
    timestamp: (item: T) => string,
    canonicalId: (item: T) => string,
  ): T[] => {
    const winners = new Map<string, T>();
    for (const item of items) {
      const current = winners.get(item.date);
      if (!current || timestamp(item) > timestamp(current) || (timestamp(item) === timestamp(current) && item.id > current.id)) winners.set(item.date, item);
    }
    return [...winners.values()].map((item) => ({ ...item, id: canonicalId(item) }));
  };

  return {
    habits,
    habitLogs,
    sleepLogs: dedupe(
      array(rawData.sleepLogs, "data.sleepLogs") as SleepLog[],
      (entry) => entry.updatedAt ?? entry.sleepStartedAt,
      (entry) => `sleep-log:${entry.date}`,
    ),
    dayCheckIns: dedupe(
      array(rawData.dayCheckIns, "data.dayCheckIns") as DayCheckIn[],
      (entry) => entry.updatedAt ?? "",
      (entry) => entry.date,
    ),
    waterLogs: array(rawData.waterLogs, "data.waterLogs") as WaterLog[],
    scheduleItems: array(rawData.scheduleItems, "data.scheduleItems") as ScheduleItem[],
    moduleTasks: array(rawData.moduleTasks, "data.moduleTasks") as ModuleTask[],
    therapyNotes: array(rawData.therapyNotes, "data.therapyNotes") as TherapyNote[],
    settings: migratedSettings,
    meta: [{
      id: "database-meta",
      seedVersion: CURRENT_SEED_VERSION,
      seededAt: exportedAt,
      bootstrapCompleted: true,
    }],
  };
}

/** Clona, migra e valida tudo antes de o chamador iniciar qualquer `clear()`. */
export function normalizeAndValidateBackup(input: unknown): LifeOSBackupV2 {
  let cloned: unknown;
  try { cloned = structuredClone(input); }
  catch { return fail("raiz", "conteudo nao serializavel"); }
  const root = record(cloned, "raiz");
  if (root.format !== "lifeos-backup") fail("format", "formato desconhecido");
  const schemaVersion = integer(root.schemaVersion, "schemaVersion", 1, 2);
  const exportedAt = isoDate(root.exportedAt, "exportedAt");
  const rawData = record(root.data, "data");
  const data = schemaVersion === 1
    ? migrateV1(rawData, exportedAt)
    : rawData as unknown as LifeOSBackupData;
  const requireV2Fields = true;

  const validated: LifeOSBackupData = {
    habits: array(data.habits, "data.habits").map((value, index) => validateHabit(value, `data.habits[${index}]`, requireV2Fields)),
    habitLogs: array(data.habitLogs, "data.habitLogs").map((value, index) => validateHabitLog(value, `data.habitLogs[${index}]`, requireV2Fields)),
    sleepLogs: array(data.sleepLogs, "data.sleepLogs").map((value, index) => validateSleep(value, `data.sleepLogs[${index}]`)),
    dayCheckIns: array(data.dayCheckIns, "data.dayCheckIns").map((value, index) => validateCheckIn(value, `data.dayCheckIns[${index}]`)),
    waterLogs: array(data.waterLogs, "data.waterLogs").map((value, index) => validateWater(value, `data.waterLogs[${index}]`)),
    scheduleItems: array(data.scheduleItems, "data.scheduleItems").map((value, index) => validateSchedule(value, `data.scheduleItems[${index}]`)),
    moduleTasks: array(data.moduleTasks, "data.moduleTasks").map((value, index) => validateTask(value, `data.moduleTasks[${index}]`)),
    therapyNotes: array(data.therapyNotes, "data.therapyNotes").map((value, index) => validateTherapyNote(value, `data.therapyNotes[${index}]`)),
    settings: array(data.settings, "data.settings").map((value, index) => validateSettings(value, `data.settings[${index}]`)),
    meta: array(data.meta, "data.meta").map((value, index) => validateMeta(value, `data.meta[${index}]`)),
  };

  for (const [name, values] of Object.entries(validated)) assertUnique(values as Array<{ id: string }>, (entry) => entry.id, `data.${name}`);
  if (validated.settings.length !== 1) fail("data.settings", "exatamente uma configuracao e obrigatoria");
  if (validated.meta.length !== 1) fail("data.meta", "exatamente um controle de bootstrap e obrigatorio");
  assertUnique(validated.habitLogs, (log) => `${log.habitId}\u0000${log.date}`, "data.habitLogs");
  assertUnique(validated.sleepLogs, (log) => log.date, "data.sleepLogs");
  assertUnique(validated.dayCheckIns, (entry) => entry.date, "data.dayCheckIns");
  const customIds = new Set((validated.settings[0].customCategories ?? []).map(c => c.id));
  const categoryReferences = [...validated.habits.map(h => h.category), ...validated.scheduleItems.map(s => s.category), ...validated.moduleTasks.map(t => t.module), ...validated.settings[0].enabledModules];
  for (const category of categoryReferences) if (category.startsWith('custom:') && !customIds.has(category as `custom:${string}`)) fail('data', `categoria inexistente: ${category}`);
  const habitIds = new Set(validated.habits.map((habit) => habit.id));
  for (const log of validated.habitLogs) if (!habitIds.has(log.habitId)) fail("data.habitLogs", `habito inexistente: ${log.habitId}`);
  for (const habit of validated.habits) {
    const expectedXp = validated.habitLogs.filter((log) => log.habitId === habit.id).reduce((sum, log) => sum + (log.xpAwarded ?? 0), 0);
    if (habit.currentXp !== expectedXp || habit.level !== Math.floor(expectedXp / 100) + 1) {
      fail(`data.habits.${habit.id}`, "XP/level divergem dos premios congelados nos logs");
    }
  }

  return { format: "lifeos-backup", schemaVersion: 2, exportedAt, data: validated };
}

/**
 * Substitui o banco somente depois que todo o payload foi clonado, migrado e
 * validado. Qualquer erro anterior ou dentro da transacao preserva o snapshot
 * local que existia antes da tentativa.
 */
export async function replaceDatabaseFromBackup(
  database: LifeOSDatabase,
  input: unknown,
): Promise<LifeOSBackupV2> {
  const normalized = normalizeAndValidateBackup(input);
  const data = normalized.data;
  await database.transaction(
    "rw",
    [
      database.habits,
      database.habitLogs,
      database.sleepLogs,
      database.dayCheckIns,
      database.waterLogs,
      database.scheduleItems,
      database.moduleTasks,
      database.therapyNotes,
      database.settings,
      database.meta,
    ],
    async () => {
      await Promise.all([
        database.habits.clear(),
        database.habitLogs.clear(),
        database.sleepLogs.clear(),
        database.dayCheckIns.clear(),
        database.waterLogs.clear(),
        database.scheduleItems.clear(),
        database.moduleTasks.clear(),
        database.therapyNotes.clear(),
        database.settings.clear(),
        database.meta.clear(),
      ]);
      await Promise.all([
        database.habits.bulkPut(data.habits),
        database.habitLogs.bulkPut(data.habitLogs),
        database.sleepLogs.bulkPut(data.sleepLogs),
        database.dayCheckIns.bulkPut(data.dayCheckIns),
        database.waterLogs.bulkPut(data.waterLogs),
        database.scheduleItems.bulkPut(data.scheduleItems),
        database.moduleTasks.bulkPut(data.moduleTasks),
        database.therapyNotes.bulkPut(data.therapyNotes),
        database.settings.bulkPut(data.settings),
        database.meta.bulkPut(data.meta),
      ]);
    },
  );
  return normalized;
}
