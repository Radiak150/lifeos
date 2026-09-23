import { DEFAULT_HABITS, DEFAULT_IDS, DEFAULT_SETTINGS } from './defaults'
import type { Habit, LifeOSSettings, ModuleName } from '../domain/types'
import { todayKey } from '../domain/date'
import type { LifeOSDatabase } from './db'

/** Instalação pública: sem agenda, tarefas, profissão ou histórico do autor. */
export function blankSettings(now = new Date()): LifeOSSettings {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    profile: { displayName: '', hasCat: false },
    appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'light' },
    enabledModules: [],
    customCategories: [],
    onboarding: { completed: false, version: 1 },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  }
}

export type StarterDraft = { name: string; modules: ModuleName[]; starterHabit: 'blank' | 'basic' | 'teeth' | 'sleep' | 'custom'; habitName: string; minimumVersion: string; waterGoalMl: number }

/** Operação única: uma falha não deixa perfil pronto com hábito faltando. */
export async function finishOnboarding(database: LifeOSDatabase, draft: StarterDraft, now = new Date()) {
  if (!Number.isInteger(draft.waterGoalMl) || draft.waterGoalMl < 1) throw new Error('Informe uma meta pessoal de água válida.')
  if (draft.starterHabit === 'custom' && (!draft.habitName.trim() || !draft.minimumVersion.trim())) throw new Error('Escreva o hábito e sua versão mínima.')
  await database.transaction('rw', database.settings, database.habits, async () => {
    const settings = await database.settings.get(DEFAULT_IDS.settings)
    if (!settings || settings.onboarding?.completed !== false) throw new Error('A configuração inicial já foi concluída. Use Configurações para alterá-la.')
    const date = todayKey(now, settings.timezone)
    const choices = draft.starterHabit === 'basic' ? ['teeth','sleep','water'] : draft.starterHabit === 'blank' ? [] : [draft.starterHabit]
    for (const choice of choices) {
      const template = structuredClone(DEFAULT_HABITS.find(h => h.id === (choice === 'sleep' ? DEFAULT_IDS.habit.registerSleep : choice === 'water' ? DEFAULT_IDS.habit.water : DEFAULT_IDS.habit.brushTeethMorning))!)
      const habit: Habit = { ...template,
        id: choice === 'custom' ? `habit:${crypto.randomUUID()}` : template.id,
        name: choice === 'custom' ? draft.habitName.trim() : choice === 'water' ? 'Registrar água' : template.name,
        category: choice === 'custom' ? 'personal' : choice === 'teeth' ? 'hygiene' : template.category,
        minimumVersion: choice === 'custom' ? draft.minimumVersion.trim() : template.minimumVersion,
        objective: choice === 'water' ? 'Registrar a água consumida durante o dia.' : choice === 'sleep' ? 'Acompanhar seus horários de descanso.' : 'Cuidado escolhido para sua rotina.',
        status: 'active', frequency: { type: 'daily' },
        xpReward: choice === 'water' ? 0 : 10,
        icon: choice === 'custom' ? 'general' : template.icon,
        startsOn: date, planHistory: undefined, currentXp: 0, level: 1,
        createdAt: now.toISOString(), updatedAt: now.toISOString(),
      }
      habit.planHistory = [{ effectiveFrom: date, status: habit.status, frequency: habit.frequency, phaseId: habit.phaseId, startsOn: date }]
      await database.habits.add(habit)
    }
    await database.settings.put({ ...settings,
      profile: { ...settings.profile, displayName: draft.name.trim().slice(0, 60) },
      waterGoalMl: draft.waterGoalMl, enabledModules: [...new Set(draft.modules)],
      onboarding: { completed: true, completedAt: now.toISOString(), version: 1 }, updatedAt: now.toISOString(),
    })
  })
}
