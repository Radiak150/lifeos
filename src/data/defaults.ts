import type {
  Habit,
  LifeOSSettings,
} from "../domain/types";

/** IDs publicos e estaveis para referencias entre telas e registros. */
export const DEFAULT_IDS = {
  settings: "lifeos-settings",
  phase: {
    foundation: "phase:foundation",
  },
  habit: {
    brushTeethMorning: "habit:brush-teeth-morning",
    registerSleep: "habit:register-sleep",
    checkBackpack: "habit:check-backpack",
    water: "habit:water",
    shower: "habit:shower",
    catLitter: "habit:cat-litter",
    dishes: "habit:dishes",
    walkCat: "habit:walk-cat",
    gym: "habit:gym",
  },
  schedule: {
    protectedCommute: "schedule:protected-commute-weekdays",
    work: "schedule:work-weekdays",
    lunch: "schedule:lunch-weekdays",
    therapy: "schedule:therapy-thursday",
    fushiSession: "schedule:fushi-saturday",
  },
  task: {
    collegeTcc: "task:college:tcc",
    collegeIntegratorProject: "task:college:integrator-project",
  },
} as const;

const SEEDED_AT = "2026-08-10T02:07:25.000Z";
const START_DATE = "2026-08-09";

export const DEFAULT_SETTINGS: LifeOSSettings = {
  id: DEFAULT_IDS.settings,
  schemaVersion: 1,
  timezone: "America/Sao_Paulo",
  weekStartsOn: 0,
  completion: {
    excellentAt: 75,
    partialAt: 50,
    partialWeight: 0.5,
    skippedHabitPolicy: "exclude",
  },
  activePhaseId: DEFAULT_IDS.phase.foundation,
  // Valor inicial editável no primeiro acesso; não representa consumo registrado.
  waterGoalMl: 800,
  enabledModules: [],
  profile: {
    displayName: "",
    hasCat: false,
  },
  appearance: {
    density: "comfortable",
    fontScale: 1,
    reduceMotion: false,
    highContrast: false,
    focusMode: false,
  },
  sync: {
    provider: "local",
  },
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
};

function habit(
  value: Omit<Habit, "createdAt" | "updatedAt" | "level" | "currentXp" | "xpReward"> &
    Partial<Pick<Habit, "level" | "currentXp" | "xpReward">>,
): Habit {
  return {
    level: 1,
    currentXp: 0,
    xpReward: 10,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
    ...value,
  };
}

export const DEFAULT_HABITS: readonly Habit[] = [
  habit({
    id: DEFAULT_IDS.habit.brushTeethMorning,
    name: "Escovar os dentes ao acordar",
    category: "health",
    objective: "Treinar uma rotina mínima ao levantar.",
    minimumVersion: "Escovar os dentes ao levantar.",
    frequency: { type: "daily" },
    status: "active",
    phaseId: DEFAULT_IDS.phase.foundation,
    startsOn: START_DATE,
    sortOrder: 10,
    icon: "tooth",
  }),
  habit({
    id: DEFAULT_IDS.habit.registerSleep,
    name: "Registrar horário do sono",
    category: "sleep",
    objective: "Acompanhar seus horários de descanso.",
    minimumVersion: "Registrar o horário em que dormiu.",
    frequency: { type: "daily" },
    status: "active",
    phaseId: DEFAULT_IDS.phase.foundation,
    startsOn: START_DATE,
    sortOrder: 20,
    icon: "moon",
  }),
  habit({
    id: DEFAULT_IDS.habit.water,
    name: "Beber água",
    category: "health",
    objective: "Registrar a água consumida durante o dia.",
    minimumVersion: "Registrar a água consumida.",
    frequency: { type: "unscheduled" },
    status: "future",
    phaseId: "phase:future",
    sortOrder: 40,
    icon: "water",
  }),
];
