import type { CustomCategory } from './types'

export const CATEGORY_COLORS = ['green', 'purple', 'blue', 'yellow', 'red'] as const
export const CATEGORY_ICONS = ['general', 'book', 'home', 'briefcase', 'dumbbell', 'fushi', 'notebook', 'partner', 'paws', 'sparkle'] as const
export function validateCategories(value: unknown): asserts value is CustomCategory[] {
  if (!Array.isArray(value) || value.length > 40) throw new Error('Use no máximo 40 categorias próprias.')
  const ids = new Set<string>(), names = new Set<string>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') throw new Error('Categoria inválida.')
    const c = entry as CustomCategory
    if (typeof c.id !== 'string' || !/^custom:[a-zA-Z0-9-]{1,80}$/.test(c.id) || ids.has(c.id)) throw new Error('Identificador de categoria inválido ou duplicado.')
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 40 || names.has(c.name.trim().toLocaleLowerCase('pt-BR'))) throw new Error('Use um nome único de até 40 caracteres por categoria.')
    if (!CATEGORY_COLORS.includes(c.color) || !(CATEGORY_ICONS as readonly string[]).includes(c.icon) || typeof c.archived !== 'boolean') throw new Error('Cor, ícone ou estado da categoria inválido.')
    ids.add(c.id); names.add(c.name.trim().toLocaleLowerCase('pt-BR'))
  }
}
