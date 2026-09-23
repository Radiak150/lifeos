import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";

import { LifeOSDatabase, seedDatabaseIfNeeded } from "../data/db";
import type { DayCheckIn, Habit, HabitLog, SleepLog, WaterLog } from "./types";
import {
  calculateHabitStreak,
  getDailyCompletion,
  getDueHabits,
  getHeatmapData,
  getLastNDaysMetrics,
  hasFixedWeeklySchedule,
  isHabitDueOn,
} from "./metrics";

const timestamp = "2026-08-01T12:00:00-03:00";

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "habit:test",
    name: "Habito de teste",
    category: "health",
    objective: "Testar",
    minimumVersion: "Fazer",
    frequency: { type: "daily" },
    status: "active",
    phaseId: "phase:test",
    xpReward: 10,
    level: 1,
    currentXp: 0,
    sortOrder: 1,
    startsOn: "2026-08-01",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function makeLog(
  habitId: string,
  date: string,
  status: HabitLog["status"] = "done",
): HabitLog {
  return {
    id: `habit-log:${habitId}:${date}`,
    habitId,
    date,
    status,
    updatedAt: `${date}T12:00:00-03:00`,
  };
}

describe("getDueHabits", () => {
  it("inclui apenas habitos rastreaveis e previstos no dia", () => {
    const monday = makeHabit({
      id: "monday",
      frequency: { type: "weekdays", weekdays: [1] },
    });
    const future = makeHabit({ id: "future", status: "future" });

    expect(getDueHabits([future, monday], "2026-08-03").map(({ id }) => id)).toEqual([
      "monday",
    ]);
    expect(getDueHabits([monday], "2026-08-04")).toEqual([]);
  });

  it("mantem o historico anterior quando a regra e pausada ou editada", () => {
    const habit = makeHabit({
      status: "paused",
      frequency: { type: "weekdays", weekdays: [1] },
      planHistory: [
        {
          effectiveFrom: "2026-08-01",
          status: "active",
          frequency: { type: "daily" },
          phaseId: "phase:test",
          startsOn: "2026-08-01",
        },
        {
          effectiveFrom: "2026-08-10",
          status: "paused",
          frequency: { type: "weekdays", weekdays: [1] },
          phaseId: "phase:test",
          startsOn: "2026-08-01",
        },
      ],
    });

    expect(isHabitDueOn(habit, "2026-08-09")).toBe(true);
    expect(isHabitDueOn(habit, "2026-08-10")).toBe(false);
  });

  it("agenda meta semanal apenas quando os dias fixos correspondem a meta", () => {
    const fixed: Habit["frequency"] = { type: "weekly-target", target: 3, preferredWeekdays: [1, 3, 5] };
    const ambiguous: Habit["frequency"] = { type: "weekly-target", target: 3, preferredWeekdays: [1, 3] };
    const fixedHabit = makeHabit({ frequency: fixed });
    const ambiguousHabit = makeHabit({ frequency: ambiguous });

    expect(hasFixedWeeklySchedule(fixed)).toBe(true);
    expect(isHabitDueOn(fixedHabit, "2026-08-03")).toBe(true);
    expect(isHabitDueOn(fixedHabit, "2026-08-04")).toBe(false);
    expect(hasFixedWeeklySchedule(ambiguous)).toBe(false);
    expect(isHabitDueOn(ambiguousHabit, "2026-08-03")).toBe(false);
  });
});

describe("getDailyCompletion", () => {
  it("distingue ausencia de dados de um dia ruim", () => {
    const habit = makeHabit();
    const empty = getDailyCompletion([habit], [], "2026-08-02");
    const missed = getDailyCompletion(
      [habit],
      [makeLog(habit.id, "2026-08-02", "missed")],
      "2026-08-02",
    );

    expect(empty.percentage).toBeNull();
    expect(empty.classification).toBe("no-data");
    expect(missed.percentage).toBe(0);
    expect(missed.classification).toBe("poor");
  });

  it("aplica peso parcial, limites configuraveis e exclusao de pausas", () => {
    const first = makeHabit({ id: "first" });
    const second = makeHabit({ id: "second" });
    const third = makeHabit({ id: "third" });
    const result = getDailyCompletion(
      [first, second, third],
      [
        makeLog(first.id, "2026-08-02", "done"),
        makeLog(second.id, "2026-08-02", "partial"),
        makeLog(third.id, "2026-08-02", "skipped"),
      ],
      "2026-08-02",
    );

    expect(result.eligibleCount).toBe(2);
    expect(result.percentage).toBe(75);
    expect(result.classification).toBe("excellent");
  });
});

describe("calculateHabitStreak", () => {
  it("calcula sequencia atual e recorde respeitando dias previstos", () => {
    const habit = makeHabit({
      frequency: { type: "weekdays", weekdays: [1, 3, 5] },
    });
    const logs = [
      makeLog(habit.id, "2026-08-03"),
      makeLog(habit.id, "2026-08-05"),
      makeLog(habit.id, "2026-08-07", "missed"),
      makeLog(habit.id, "2026-08-10"),
      makeLog(habit.id, "2026-08-12"),
    ];

    expect(calculateHabitStreak(habit, logs, "2026-08-14")).toEqual({
      current: 2,
      best: 2,
    });
  });
});

describe("getLastNDaysMetrics", () => {
  it("calcula medias reais sem converter dias sem dado em registros", () => {
    const habit = makeHabit();
    const sleepLogs: SleepLog[] = [
      {
        id: "sleep:1",
        date: "2026-08-09",
        sleepStartedAt: "2026-08-08T23:30:00-03:00",
        wokeAt: "2026-08-09T07:30:00-03:00",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
    const waterLogs: WaterLog[] = [
      {
        id: "water:1",
        date: "2026-08-09",
        amountMl: 800,
        recordedAt: "2026-08-09T20:00:00-03:00",
      },
    ];
    const dayCheckIns: DayCheckIn[] = [
      {
        id: "2026-08-09",
        date: "2026-08-09",
        energy: 3,
        overload: 4,
        difficulty: 2,
        updatedAt: timestamp,
      },
    ];
    const result = getLastNDaysMetrics({
      habits: [habit],
      habitLogs: [makeLog(habit.id, "2026-08-09")],
      sleepLogs,
      waterLogs,
      dayCheckIns,
      endDate: "2026-08-09",
      days: 2,
    });

    expect(result.recordedCompletionDays).toBe(1);
    expect(result.averageCompletionPercent).toBe(100);
    expect(result.averageSleepMinutes).toBe(480);
    expect(result.averageWaterMl).toBe(800);
    expect(result.averageWaterMlOnRecordedDays).toBe(800);
    expect(result.averageWaterMlPerCalendarDay).toBe(400);
    expect(result.averageEnergy).toBe(3);
    expect(result.averageOverload).toBe(4);
  });

  it("gera os 90 pontos do heatmap, incluindo sem-dados", () => {
    const heatmap = getHeatmapData([], [], "2026-08-09");
    expect(heatmap).toHaveLength(90);
    expect(heatmap[0].classification).toBe("no-data");
    expect(heatmap.at(-1)?.date).toBe("2026-08-09");
  });
});

describe("seedDatabaseIfNeeded", () => {
  it("persiste o bootstrap real uma vez e mantem tabelas de registro vazias", async () => {
    const database = new LifeOSDatabase("lifeos-domain-test");
    await database.delete();
    await database.open();

    try {
      await seedDatabaseIfNeeded(database);
      await seedDatabaseIfNeeded(database);

      expect(await database.habits.count()).toBe(0);
      expect((await database.settings.get("lifeos-settings"))?.onboarding?.completed).toBe(false);
      expect(await database.scheduleItems.count()).toBe(0);
      expect(await database.habitLogs.count()).toBe(0);
      expect(await database.sleepLogs.count()).toBe(0);
      expect(await database.dayCheckIns.count()).toBe(0);
      expect(await database.waterLogs.count()).toBe(0);
      expect(await database.therapyNotes.count()).toBe(0);
    } finally {
      await database.delete();
    }
  });
});
