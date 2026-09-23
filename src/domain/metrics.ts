import { differenceInMinutes, parseISO } from "date-fns";

import {
  dateKeysBetween,
  daysBetween,
  isDateWithin,
  lastNDateKeys,
  weekdayOf,
} from "./date";
import type {
  CompletionSettings,
  DailyCompletion,
  DateKey,
  DayCheckIn,
  DayClassification,
  Habit,
  HabitFrequency,
  HabitLog,
  HabitPlanVersion,
  HabitStatus,
  HabitStreak,
  HeatmapDay,
  LifeOSSettings,
  SleepLog,
  WaterLog,
} from "./types";

export const DEFAULT_COMPLETION_SETTINGS: CompletionSettings = {
  excellentAt: 75,
  partialAt: 50,
  partialWeight: 0.5,
  skippedHabitPolicy: "exclude",
};

type SettingsInput = LifeOSSettings | CompletionSettings | undefined;

function completionSettings(input: SettingsInput): CompletionSettings {
  if (!input) return DEFAULT_COMPLETION_SETTINGS;
  return "completion" in input ? input.completion : input;
}

export function isTrackableStatus(status: HabitStatus): boolean {
  return status === "active" || status === "trial" || status === "consolidated";
}

export function hasFixedWeeklySchedule(frequency: HabitFrequency): boolean {
  if (frequency.type !== "weekly-target") return true;
  if (!Number.isInteger(frequency.target) || frequency.target < 1 || frequency.target > 7) {
    return false;
  }
  const weekdays = frequency.preferredWeekdays ?? [];
  return new Set(weekdays).size === frequency.target && weekdays.length === frequency.target;
}

export function getHabitPlanOn(habit: Habit, date: DateKey): HabitPlanVersion | null {
  const history = habit.planHistory;
  if (!history?.length) {
    return {
      effectiveFrom: habit.startsOn ?? habit.createdAt.slice(0, 10),
      status: habit.status,
      frequency: habit.frequency,
      phaseId: habit.phaseId,
      startsOn: habit.startsOn,
      endsOn: habit.endsOn,
    };
  }

  let selected: HabitPlanVersion | null = null;
  for (const version of history) {
    if (version.effectiveFrom <= date && (!selected || version.effectiveFrom > selected.effectiveFrom)) {
      selected = version;
    }
  }
  return selected;
}

export function xpAwardForStatus(
  status: HabitLog["status"] | null | undefined,
  reward: number,
  partialWeight: number,
): number {
  const safeReward = Number.isFinite(reward) ? Math.max(0, Math.round(reward)) : 0;
  if (status === "done") return safeReward;
  if (status === "partial") {
    const safeWeight = Number.isFinite(partialWeight)
      ? Math.max(0, Math.min(1, partialWeight))
      : DEFAULT_COMPLETION_SETTINGS.partialWeight;
    return Math.round(safeReward * safeWeight);
  }
  return 0;
}

export function isHabitDueOn(habit: Habit, date: DateKey): boolean {
  const plan = getHabitPlanOn(habit, date);
  if (!plan || !isTrackableStatus(plan.status) || !isDateWithin(date, plan.startsOn, plan.endsOn)) {
    return false;
  }

  switch (plan.frequency.type) {
    case "daily":
      return true;
    case "weekdays":
      return plan.frequency.weekdays.includes(weekdayOf(date));
    case "interval": {
      if (
        !Number.isInteger(plan.frequency.everyDays) ||
        plan.frequency.everyDays < 1 ||
        date < plan.frequency.anchorDate
      ) {
        return false;
      }
      return daysBetween(plan.frequency.anchorDate, date) % plan.frequency.everyDays === 0;
    }
    case "weekly-target":
      return hasFixedWeeklySchedule(plan.frequency)
        ? plan.frequency.preferredWeekdays!.includes(weekdayOf(date))
        : false;
    case "unscheduled":
      return false;
  }
}

/** Habitos que realmente entram no denominador do dia informado. */
export function getDueHabits(habits: readonly Habit[], date: DateKey): Habit[] {
  return habits
    .filter((habit) => isHabitDueOn(habit, date))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function getDayClassification(
  percentage: number | null,
  settings?: SettingsInput,
): DayClassification {
  if (percentage === null || !Number.isFinite(percentage)) return "no-data";
  const config = completionSettings(settings);
  if (percentage >= config.excellentAt) return "excellent";
  if (percentage >= config.partialAt) return "partial";
  return "poor";
}

export function getDailyCompletion(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  date: DateKey,
  settings?: SettingsInput,
): DailyCompletion {
  const config = completionSettings(settings);
  const due = getDueHabits(habits, date);
  const dueIds = new Set(due.map(({ id }) => id));
  const logsByHabit = new Map<string, HabitLog>();

  for (const log of logs) {
    if (log.date === date && dueIds.has(log.habitId)) {
      // O schema impede duplicatas; em arrays externos, o ultimo vence.
      logsByHabit.set(log.habitId, log);
    }
  }

  let doneCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let skippedCount = 0;
  let points = 0;

  for (const habit of due) {
    const status = logsByHabit.get(habit.id)?.status;
    if (status === "done") {
      doneCount += 1;
      points += 1;
    } else if (status === "partial") {
      partialCount += 1;
      points += config.partialWeight;
    } else if (status === "missed") {
      missedCount += 1;
    } else if (status === "skipped") {
      skippedCount += 1;
    }
  }

  const recordedCount = logsByHabit.size;
  const eligibleCount =
    config.skippedHabitPolicy === "exclude" ? due.length - skippedCount : due.length;
  const percentage =
    recordedCount === 0 || eligibleCount === 0
      ? null
      : Math.round(Math.max(0, Math.min(100, (points / eligibleCount) * 100)));

  return {
    date,
    dueCount: due.length,
    eligibleCount,
    recordedCount,
    doneCount,
    partialCount,
    missedCount,
    skippedCount,
    percentage,
    classification: getDayClassification(percentage, config),
  };
}

export interface HabitStreakOptions {
  partialCounts?: boolean;
  /** Um habito ainda nao marcado no proprio throughDate nao quebra a sequencia. */
  allowPendingThroughDate?: boolean;
}

export function calculateHabitStreak(
  habit: Habit,
  logs: readonly HabitLog[],
  throughDate: DateKey,
  options: HabitStreakOptions = {},
): HabitStreak {
  const relevantLogs = logs
    .filter((log) => log.habitId === habit.id && log.date <= throughDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  const planStartDates = habit.planHistory?.flatMap((plan) => [plan.effectiveFrom, ...(plan.startsOn ? [plan.startsOn] : [])]) ?? [];
  const firstDate = [...planStartDates, ...(habit.startsOn ? [habit.startsOn] : []), ...(relevantLogs[0] ? [relevantLogs[0].date] : [])]
    .sort()[0] ?? throughDate;
  if (firstDate > throughDate) return { current: 0, best: 0 };

  const byDate = new Map(relevantLogs.map((log) => [log.date, log]));
  const partialCounts = options.partialCounts ?? false;
  const allowPending = options.allowPendingThroughDate ?? true;
  let running = 0;
  let best = 0;

  for (const date of dateKeysBetween(firstDate, throughDate)) {
    if (!isHabitDueOn(habit, date)) continue;
    const log = byDate.get(date);

    if (log?.status === "skipped") continue;
    if (log?.status === "done" || (partialCounts && log?.status === "partial")) {
      running += 1;
      best = Math.max(best, running);
      continue;
    }
    if (!log && allowPending && date === throughDate) continue;
    running = 0;
  }

  return { current: running, best };
}

function sleepDuration(log: SleepLog): number | null {
  if (typeof log.durationMinutes === "number" && log.durationMinutes >= 0) {
    return log.durationMinutes;
  }
  if (!log.wokeAt) return null;
  const minutes = differenceInMinutes(parseISO(log.wokeAt), parseISO(log.sleepStartedAt));
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

export interface LastNDaysMetricsInput {
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  sleepLogs?: readonly SleepLog[];
  waterLogs?: readonly WaterLog[];
  dayCheckIns?: readonly DayCheckIn[];
  endDate: DateKey;
  days?: number;
  settings?: SettingsInput;
}

export interface LastNDaysMetrics {
  startDate: DateKey;
  endDate: DateKey;
  days: number;
  daily: DailyCompletion[];
  recordedCompletionDays: number;
  averageCompletionPercent: number | null;
  recordedSleepDays: number;
  averageSleepMinutes: number | null;
  recordedCheckInDays: number;
  averageEnergy: number | null;
  averageOverload: number | null;
  averageDifficulty: number | null;
  recordedWaterDays: number;
  totalWaterMl: number;
  /** Media somente entre dias com registro; ausencia nunca vira consumo zero. */
  averageWaterMl: number | null;
  /** Alias explicito para consumidores de UI. */
  averageWaterMlOnRecordedDays: number | null;
  /** Projecao opcional de cobertura, sem substituir a media observada. */
  averageWaterMlPerCalendarDay: number;
}

export function getLastNDaysMetrics(input: LastNDaysMetricsInput): LastNDaysMetrics {
  const days = input.days ?? 30;
  const dates = lastNDateKeys(input.endDate, days);
  const dateSet = new Set(dates);
  const daily = dates.map((date) =>
    getDailyCompletion(input.habits, input.habitLogs, date, input.settings),
  );
  const withCompletion = daily.filter(({ percentage }) => percentage !== null);
  const averageCompletionPercent = withCompletion.length
    ? Math.round(
        withCompletion.reduce((sum, day) => sum + (day.percentage ?? 0), 0) /
          withCompletion.length,
      )
    : null;

  const sleepPerDay = new Map<DateKey, number>();
  for (const log of input.sleepLogs ?? []) {
    if (!dateSet.has(log.date)) continue;
    const duration = sleepDuration(log);
    if (duration === null) continue;
    sleepPerDay.set(log.date, (sleepPerDay.get(log.date) ?? 0) + duration);
  }
  const totalSleepMinutes = [...sleepPerDay.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const averageSleepMinutes = sleepPerDay.size
    ? Math.round(totalSleepMinutes / sleepPerDay.size)
    : null;

  const checkIns = (input.dayCheckIns ?? []).filter((entry) => dateSet.has(entry.date));
  const averageOptionalScale = (
    selector: (entry: DayCheckIn) => number | undefined,
  ): number | null => {
    const values = checkIns.map(selector).filter((value): value is number => value != null);
    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  };

  const waterPerDay = new Map<DateKey, number>();
  for (const log of input.waterLogs ?? []) {
    if (!dateSet.has(log.date) || log.amountMl <= 0) continue;
    waterPerDay.set(log.date, (waterPerDay.get(log.date) ?? 0) + log.amountMl);
  }
  const totalWaterMl = [...waterPerDay.values()].reduce((sum, value) => sum + value, 0);

  return {
    startDate: dates[0],
    endDate: input.endDate,
    days,
    daily,
    recordedCompletionDays: withCompletion.length,
    averageCompletionPercent,
    recordedSleepDays: sleepPerDay.size,
    averageSleepMinutes,
    recordedCheckInDays: checkIns.length,
    averageEnergy: averageOptionalScale((entry) => entry.energy),
    averageOverload: averageOptionalScale((entry) => entry.overload),
    averageDifficulty: averageOptionalScale((entry) => entry.difficulty),
    recordedWaterDays: waterPerDay.size,
    totalWaterMl,
    averageWaterMl: waterPerDay.size
      ? Math.round(totalWaterMl / waterPerDay.size)
      : null,
    averageWaterMlOnRecordedDays: waterPerDay.size
      ? Math.round(totalWaterMl / waterPerDay.size)
      : null,
    averageWaterMlPerCalendarDay: Math.round(totalWaterMl / days),
  };
}

export function getHeatmapData(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  endDate: DateKey,
  settings?: SettingsInput,
  days = 90,
): HeatmapDay[] {
  return lastNDateKeys(endDate, days).map((date) =>
    getDailyCompletion(habits, logs, date, settings),
  );
}

/** Sequência de dias que atingiram o limiar Excelente; hoje pendente tem margem. */
export function calculateRoutineStreak(habits: readonly Habit[], logs: readonly HabitLog[], throughDate: DateKey, settings?: SettingsInput): HabitStreak {
  const firstDate = logs.filter((log) => log.date <= throughDate).map((log) => log.date).sort()[0]
  if (!firstDate) return { current: 0, best: 0 }
  let current = 0
  let best = 0
  for (const date of dateKeysBetween(firstDate, throughDate)) {
    const day = getDailyCompletion(habits, logs, date, settings)
    if (!day.dueCount) continue
    if (day.classification === 'excellent') { current++; best = Math.max(best, current) }
    else if (date !== throughDate || day.recordedCount === day.eligibleCount) current = 0
  }
  return { current, best }
}
