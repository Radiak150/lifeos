import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FolderPlus, Archive, RotateCcw, Pencil } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { useCategories } from '../hooks/useCategories'
import { getIcon } from '../lib/presentation'
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../domain/categories'
import type { CustomCategory } from '../domain/types'
import { PageHeading } from '../components/PageHeading'
import { Button, Card, Field, Modal } from '../components/ui'

const colorNames = ['Verde', 'Violeta', 'Azul', 'Amarelo', 'Rosa']
const iconNames = ['Alvo', 'Livro', 'Casa', 'Trabalho', 'Treino', 'Jogo', 'Anotações', 'Coração', 'Animal', 'Estrela']
export default function CategoriesPage() {
  const { settings, updateSettings } = useLifeOS()
  const { categories, modules } = useCategories()
  const [form, setForm] = useState<CustomCategory | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault(); if (!form) return
    setSaving(true); setError('')
    try {
      await updateSettings({ customCategories: [...categories.filter(c => c.id !== form.id), { ...form, name: form.name.trim() }] })
      setForm(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { setSaving(false) }
  }
  async function archive(category: CustomCategory) {
    try { await updateSettings({ customCategories: categories.map(c => c.id === category.id ? { ...c, archived: !c.archived } : c) }); setError('') }
    catch { setError('Não foi possível alterar a categoria.') }
  }
  return <div className="page guide-page">
    <PageHeading eyebrow="Seu espaço" title="Categorias" description="Agrupe hábitos, horários e tarefas por assunto. Uma categoria não é uma atividade: ela é o lugar onde você organiza atividades relacionadas." actions={<Button onClick={() => { setError(''); setForm({ id: `custom:${crypto.randomUUID()}`, name: '', color: 'green', icon: 'general', archived: false }) }}><FolderPlus size={17} />Nova categoria</Button>} />
    <Card className="guide-tip"><strong>Exemplo: aprender inglês</strong><p>Crie “Idiomas”. Depois, cadastre o hábito “Revisar 5 palavras” e uma tarefa “Escolher um curso”. Se quiser reservar um horário, use essa mesma categoria na agenda.</p><Link to="/guide">Ver o guia de uso <ArrowUpRight size={14} /></Link></Card>
    {error && <p className="form-error" role="alert">{error}</p>}
    <h2 className="guide-section-title">Minhas categorias</h2>
    <div className="category-grid">{categories.map(c => { const Icon = getIcon(c.icon); return <Card className={`category-card area-banner--${c.color}`} key={c.id}>
      <Icon width={28} height={28} /><h2>{c.name}</h2><p>{c.archived ? 'Arquivada. Os registros continuam disponíveis.' : 'Hábitos, tarefas e horários no mesmo assunto.'}</p>
      <Link to={`/area/${c.id}`} className="button button--secondary button--sm">Abrir tarefas</Link><div className="category-actions"><Button size="sm" variant="ghost" onClick={() => { setError(''); setForm(c) }}><Pencil size={14} />Editar</Button><Button size="sm" variant="ghost" onClick={() => archive(c)}>{c.archived ? <RotateCcw size={14} /> : <Archive size={14} />}{c.archived ? 'Restaurar' : 'Arquivar'}</Button></div>
    </Card>})}{!categories.length && <Card className="category-card"><FolderPlus size={28} /><h2>Comece com um assunto</h2><p>Crie apenas as categorias que você precisa agora. Nome, cor e ícone podem ser alterados depois.</p></Card>}</div>
    <h2 className="guide-section-title">Áreas prontas no menu</h2><Card className="guide-module-list">{modules.map(({ id, label, icon: Icon }) => <label key={id}><Icon size={20} /><span>{label}</span><input type="checkbox" checked={settings.enabledModules.includes(id)} onChange={async e => {
      const enabled = e.target.checked
      try { await updateSettings({ enabledModules: enabled ? [...settings.enabledModules, id] : settings.enabledModules.filter(x => x !== id) }); setError('') } catch { setError('Não foi possível atualizar o menu.') }
    }} /></label>)}<p>Ocultar uma área muda apenas o menu; não apaga tarefas nem interrompe hábitos ativos.</p></Card>
    <Modal open={!!form} title="Configurar categoria" onClose={() => setForm(null)} footer={<><Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button><Button type="submit" form="category-form" disabled={saving}>{saving ? 'Salvando…' : 'Salvar categoria'}</Button></>}>
      {form && <form id="category-form" className="form-grid" onSubmit={save}>
        <Field label="Nome" className="form-grid__wide"><input required maxLength={40} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Idiomas, Música, Jardim" /></Field>
        <Field label="Cor"><select value={form.color} onChange={e => setForm({ ...form, color: e.target.value as CustomCategory['color'] })}>{CATEGORY_COLORS.map((c, i) => <option value={c} key={c}>{colorNames[i]}</option>)}</select></Field>
        <Field label="Ícone"><select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>{CATEGORY_ICONS.map((c, i) => <option value={c} key={c}>{iconNames[i]}</option>)}</select></Field>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>}
    </Modal>
  </div>
}
