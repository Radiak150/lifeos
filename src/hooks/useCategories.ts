import { useLifeOS } from '../app/LifeOSProvider'
import { categoryIcons, categoryLabels, moduleMeta } from '../lib/presentation'

export function useCategories() {
  const { settings } = useLifeOS()
  const categories = settings.customCategories ?? []
  const labels = { ...categoryLabels, ...Object.fromEntries(categories.map(c => [c.id, c.name + (c.archived ? ' (arquivada)' : '')])) }
  return { categories, labels, icons: { ...categoryIcons, ...Object.fromEntries(categories.map(c => [c.id, c.icon])) },
    options: (selected?: string) => Object.entries(labels).filter(([id]) => id !== 'exercise' || selected === id).filter(([id]) => !categories.find(c => c.id === id)?.archived || id === selected),
    modules: Object.entries(moduleMeta).map(([id, meta]) => ({ id: id as keyof typeof moduleMeta, label: labels[id], icon: meta.icon })),
  }
}
