import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Leaf, Layers3, Target, Droplets, MoonStar } from 'lucide-react'
import { Button, Card, Field } from '../components/ui'
import { useCategories } from '../hooks/useCategories'
import { db } from '../data/db'
import { finishOnboarding, type StarterDraft } from '../data/starter'

const steps = ['Seu perfil', 'Suas áreas', 'Cuidados básicos', 'Revisão']
export default function WelcomePage() {
  const navigate = useNavigate()
  const { modules } = useCategories()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<StarterDraft>({ name: '', modules: [], starterHabit: 'blank', habitName: '', minimumVersion: '', waterGoalMl: 800 })
  const [error, setError] = useState(''), [saving, setSaving] = useState(false)
  async function next() {
    setError('')
    if (step === 2 && draft.starterHabit === 'custom' && (!draft.habitName.trim() || !draft.minimumVersion.trim())) { setError('Preencha o nome e a versão mínima do hábito.'); return }
    if (step < 3) { setStep(step + 1); return }
    setSaving(true)
    try { await finishOnboarding(db, draft); navigate('/guide') }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir.'); setSaving(false) }
  }
  return <main className="welcome-page"><div className="welcome-brand"><span className="brand-mark">L</span><strong>LIFE<span>OS</span></strong></div>
    <div className="welcome-shell"><aside className="welcome-story"><span className="eyebrow">Um espaço que começa com você</span><h1>Sua rotina.<br />No seu ritmo.</h1><p>Comece com o necessário. O resto entra quando fizer sentido.</p><img className="welcome-art" src="/visuals/lifeos-daily-v2.png" alt="Agenda e copo de água sobre uma bandeja, iluminados pela luz da manhã" /><ol>{steps.map((s, i) => <li key={s} aria-current={i === step ? 'step' : undefined} className={i <= step ? 'active' : ''}><span>{i < step ? <Check size={14} /> : i + 1}</span>{s}</li>)}</ol><small>Seus registros ficam neste aparelho. Você escolhe o que compartilhar.</small></aside>
    <Card className="welcome-form"><span className="eyebrow">Etapa {step + 1} de 4</span>
      {step === 0 && <><h2>Como podemos chamar você?</h2><p>Personalize seu perfil para acompanhar sua rotina.</p><Field label="Como você quer ser chamado?" hint="Opcional. Você pode alterar depois."><input maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Seu nome ou apelido" autoComplete="given-name" /></Field><div className="guide-tip"><Leaf size={22} /><p>Você não precisa cadastrar o dia inteiro. Uma atividade bem definida já é um começo.</p></div></>}
      {step === 1 && <><h2>O que faz parte da sua rotina?</h2><p>Selecione os assuntos que quer organizar. Depois, você pode criar outras categorias.</p><div className="welcome-options">{modules.map(({ id, label, icon: Icon }) => <label key={id}><Icon size={23} /><span>{label}</span><input type="checkbox" checked={draft.modules.includes(id)} onChange={e => setDraft({ ...draft, modules: e.target.checked ? [...draft.modules, id] : draft.modules.filter(x => x !== id) })} /></label>)}</div><small>Suas escolhas ficam reunidas em Minhas áreas.</small></>}
      {step === 2 && <><h2>Cuidados que cabem no dia</h2><p>Ative um conjunto de registros ou crie uma atividade sua. Tudo pode ser ajustado depois.</p><Field label="Como começar"><select value={draft.starterHabit} onChange={e => setDraft({ ...draft, starterHabit: e.target.value as StarterDraft['starterHabit'] })}><option value="blank">Escolher depois</option><option value="basic">Cuidados básicos: higiene, sono e água</option><option value="custom">Criar meu primeiro hábito</option></select></Field>{draft.starterHabit === 'custom' && <><Field label="Nome do hábito"><input maxLength={100} value={draft.habitName} onChange={e => setDraft({ ...draft, habitName: e.target.value })} placeholder="Ex.: Ler um livro" /></Field><Field label="Versão mínima"><input maxLength={200} value={draft.minimumVersion} onChange={e => setDraft({ ...draft, minimumVersion: e.target.value })} placeholder="Ex.: Ler uma página depois do almoço" /></Field></>}{draft.starterHabit === 'basic' && <div className="care-bundle"><span><Target size={22} />Higiene<span>Escovar os dentes</span></span><span><MoonStar size={22} />Sono<span>Registrar uma noite</span></span><span><Droplets size={22} />Água<span>Registrar a quantidade</span></span></div>}</>}
      {step === 3 && <><h2>Seu começo está definido</h2><p>Confira antes de entrar. Você poderá mudar todas essas escolhas.</p><ul className="welcome-review"><li><Check size={17} />{draft.name || 'Sem apelido definido'}</li><li><Layers3 size={17} />{draft.modules.length} áreas selecionadas</li><li><Target size={17} />{draft.starterHabit === 'blank' ? 'Adicionar atividades depois' : draft.starterHabit === 'basic' ? 'Higiene, sono e água ativados' : 'Seu primeiro hábito ativado'}</li></ul><Field label="Meta pessoal de água (ml)" hint="Serve apenas como referência visual. Não é uma recomendação de saúde."><input type="number" min={1} value={draft.waterGoalMl} onChange={e => setDraft({ ...draft, waterGoalMl: Number(e.target.value) })} /></Field><div className="guide-tip"><p>O Guia mostra onde planejar, registrar seu dia e escolher as informações para sua terapeuta.</p></div></>}
      {error && <p className="form-error" role="alert">{error}</p>}<footer><Button variant="ghost" disabled={step === 0 || saving} onClick={() => { setError(''); setStep(step - 1) }}><ArrowLeft size={16} />Voltar</Button><Button disabled={saving} onClick={next}>{saving ? 'Preparando…' : step === 3 ? 'Entrar no meu LifeOS' : 'Continuar'}<ArrowRight size={16} /></Button></footer>
    </Card></div></main>
}
