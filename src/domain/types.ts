/**
 * Tipos centrais do LifeOS.
 *
 * Datas sem horario usam sempre `yyyy-MM-dd`. Horarios recorrentes usam
 * `HH:mm`. Instantes reais (como o momento em que um registro foi salvo)
 * usam ISO 8601 completo.
 */

export type EntityId = string;
export type DateKey = string;
export type TimeOfDay = string;
export type IsoDateTime = string;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CustomCategoryId = `custom:${string}`;
export interface CustomCategory {
  id: CustomCategoryId;
  name: string;
  color: 'green' | 'purple' | 'blue' | 'yellow' | 'red';
  icon: string;
  archived: boolean;
}

export type LifeArea = CustomCategoryId
  | "hygiene"
  | "pets"
  | "morning"
  | "health"
  | "sleep"
  | "home"
  | "fitness"
  | "exercise"
  | "relationship"
  | "college"
  | "fushi"
  | "work"
  | "therapy"
  | "personal"
  | "other";

export type HabitStatus =
  | "active"
  | "consolidated"
  | "trial"
  | "future"
  | "paused";

export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays"; weekdays: Weekday[] }
  | { type: "interval"; everyDays: number; anchorDate: DateKey }
  | {
      type: "weekly-target";
      target: number;
      /**
       * Sem dias preferidos, o habito aparece nas metas semanais, mas nao e
       * colocado arbitrariamente na lista de um dia especifico.
       */
      preferredWeekdays?: Weekday[];
    }
  | { type: "unscheduled" };

/**
 * Snapshot efetivo das regras que determinavam se um habito era devido.
 *
 * As versoes sao ordenadas por `effectiveFrom`; a ultima versao cuja data seja
 * menor ou igual ao dia consultado governa apenas aquele intervalo historico.
 * Assim, pausar ou trocar a frequencia hoje nao reescreve o calendario antigo.
 */
export interface HabitPlanVersion {
  effectiveFrom: DateKey;
  status: HabitStatus;
  frequency: HabitFrequency;
  phaseId: EntityId;
  startsOn?: DateKey;
  endsOn?: DateKey;
}

export interface Habit {
  id: EntityId;
  name: string;
  category: LifeArea;
  objective: string;
  minimumVersion: string;
  frequency: HabitFrequency;
  status: HabitStatus;
  phaseId: EntityId;
  xpReward: number;
  level: number;
  currentXp: number;
  sortOrder: number;
  icon?: string;
  startsOn?: DateKey;
  endsOn?: DateKey;
  /** Ausente somente em bancos/backups v1; a migration local o materializa. */
  planHistory?: HabitPlanVersion[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type HabitLogStatus = "done" | "partial" | "missed" | "skipped";

export interface HabitLog {
  /** Um registro por habito/dia: `habit-log:<habitId>:<yyyy-MM-dd>`. */
  id: EntityId;
  habitId: EntityId;
  date: DateKey;
  status: HabitLogStatus;
  note?: string;
  /** Recompensa congelada no momento do registro; nunca depende do premio atual. */
  xpAwarded?: number;
  completedAt?: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SleepLog {
  id: EntityId;
  /** Dia ao qual o sono sera atribuido no calendario. */
  date: DateKey;
  sleepStartedAt: IsoDateTime;
  wokeAt?: IsoDateTime;
  /** Pode ser salvo para dispositivos offline; metricas recalculam se ausente. */
  durationMinutes?: number;
  quality?: 1 | 2 | 3 | 4 | 5;
  interruptions?: number;
  note?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DayCheckIn {
  /** O proprio dia e a chave unica do check-in. */
  id: DateKey;
  date: DateKey;
  energy?: 1 | 2 | 3 | 4 | 5;
  overload?: 1 | 2 | 3 | 4 | 5;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  mood?: 1 | 2 | 3 | 4 | 5;
  difficultDay?: boolean;
  note?: string;
  updatedAt: IsoDateTime;
}

export interface WaterLog {
  id: EntityId;
  date: DateKey;
  amountMl: number;
  recordedAt: IsoDateTime;
}

export type RecurrenceRule =
  | { type: "daily" }
  | { type: "weekly"; weekdays: Weekday[] }
  | { type: "one-off"; date: DateKey };

export interface ScheduleItem {
  id: EntityId;
  title: string;
  category: LifeArea;
  recurrence: RecurrenceRule;
  startTime: TimeOfDay;
  endTime?: TimeOfDay;
  /** 1 indica madrugada do dia seguinte, no fim da rotina selecionada. */
  dayOffset?: 0 | 1;
  location?: string;
  note?: string;
  protectedTime: boolean;
  active: boolean;
  color?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type ModuleName = "pets" | "college" | "fushi" | "home" | "relationship" | "work" | "fitness" | CustomCategoryId;
export type ModuleTaskStatus =
  | "backlog"
  | "planned"
  | "in-progress"
  | "done"
  | "paused";
export type TaskPriority = "low" | "medium" | "high";
export type ModuleTaskKind = "task" | "bug" | "content" | "session" | "study" | "training";

export interface ModuleTask {
  id: EntityId;
  module: ModuleName;
  kind?: ModuleTaskKind;
  title: string;
  description?: string;
  status: ModuleTaskStatus;
  priority?: TaskPriority;
  dueDate?: DateKey;
  progressPercent?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TherapyNote {
  id: EntityId;
  date: DateKey;
  weekStart?: DateKey;
  authorRole: "owner" | "therapist";
  content: string;
  shared: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type DayClassification = "excellent" | "partial" | "poor" | "no-data";
export type SkippedHabitPolicy = "exclude" | "count-as-missed";

export interface CompletionSettings {
  excellentAt: number;
  partialAt: number;
  partialWeight: number;
  skippedHabitPolicy: SkippedHabitPolicy;
}

export interface ProfileSettings {
  displayName: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  partnerAge?: number;
  partnerHeightCm?: number;
  partnerWeightKg?: number;
  hasCat: boolean;
  occupation?: string;
  employer?: string;
  client?: string;
  college?: string;
  degree?: string;
}

export interface AppearanceSettings {
  theme?: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  fontScale: 0.9 | 1 | 1.1 | 1.2;
  reduceMotion: boolean;
  highContrast: boolean;
  focusMode: boolean;
}

export interface SyncSettings {
  provider: "local" | "supabase";
  projectUrl?: string;
  anonKey?: string;
  workspaceId?: string;
  lastSyncedAt?: IsoDateTime;
}

export interface LifeOSSettings {
  customCategories?: CustomCategory[];
  onboarding?: { completed: boolean; completedAt?: IsoDateTime; version: 1 };
  id: "lifeos-settings";
  schemaVersion: 1;
  timezone: string;
  weekStartsOn: Weekday;
  completion: CompletionSettings;
  activePhaseId: EntityId;
  waterGoalMl: number;
  enabledModules: ModuleName[];
  profile: ProfileSettings;
  appearance: AppearanceSettings;
  sync: SyncSettings;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface DatabaseMeta {
  id: "database-meta";
  seedVersion: number;
  seededAt: IsoDateTime;
  /** Diferencia um banco ja inicializado de um banco realmente vazio. */
  bootstrapCompleted: boolean;
}

export interface DailyCompletion {
  date: DateKey;
  dueCount: number;
  eligibleCount: number;
  recordedCount: number;
  doneCount: number;
  partialCount: number;
  missedCount: number;
  skippedCount: number;
  percentage: number | null;
  classification: DayClassification;
}

export interface HabitStreak {
  current: number;
  best: number;
}

export type HeatmapDay = DailyCompletion;
