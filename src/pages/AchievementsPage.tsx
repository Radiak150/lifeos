import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, CalendarCheck, Check, Flame, LockKeyhole, MoonStar, Sprout, Star, Trophy } from 'lucide-react'
import { useLifeOS } from '../app/LifeOSProvider'
import { PageHeading } from '../components/PageHeading'
import { Card, ProgressBar } from '../components/ui'
import { getAchievements, type AchievementId } from '../domain/achievements'
import { useCurrentDate } from '../hooks/useCurrentDate'
import '../achievements.css'

const icons = {
  'first-step': Sprout,
  'recorded-week': CalendarCheck,
  'streak-three': Flame,
  'streak-seven': Award,
  'first-hundred': Star,
  'sleep-three': MoonStar
} satisfies Record<AchievementId, typeof Star>

const displayDate = (date: string) => date.split('-').reverse().join('/')

export default function AchievementsPage() {
  const { habits, habitLogs, sleepLogs, dayCheckIns, settings } = useLifeOS()
  const throughDate = useCurrentDate(settings.timezone)
  const progress = useMemo(() => getAchievements({ habits, habitLogs, sleepLogs, dayCheckIns, throughDate }), [habits, habitLogs, sleepLogs, dayCheckIns, throughDate])

  return (
    <div className="page achievements-page">
      <PageHeading eyebrow="Pequenos passos, progresso real" title="Conquistas" description="Um lugar para reconhecer o que você já registrou. Sem competição ou prazo para chegar lá." />
      <Card className="achievements-level" aria-labelledby="achievements-level-title">
        <div className="achievements-level__symbol"><Trophy size={32} aria-hidden="true" /></div>
        <div className="achievements-level__main">
          <span className="eyebrow">Nível global · {progress.totalXp} XP no total</span>
          <h2 id="achievements-level-title">Nível {progress.level}</h2>
          <ProgressBar value={progress.levelXp} tone="purple" label={`Progresso para o nível ${progress.level + 1}`} />
          <p>{progress.levelXp} de 100 XP neste nível · faltam {progress.xpToNextLevel} XP para o próximo.</p>
        </div>
        <div className="achievements-level__count"><strong>{progress.unlockedCount}<span> / {progress.achievements.length}</span></strong><span>conquistas desbloqueadas</span></div>
      </Card>
      {!progress.recordedDays && <p className="achievements-empty">Sem registros ainda. Suas conquistas aparecem conforme você usa a rotina, sem dados preenchidos automaticamente. <Link to="/today">Ir para Hoje <ArrowRight size={14} aria-hidden="true" /></Link></p>}
      <section aria-label="Marcos da sua rotina" className="achievements-grid">
        {progress.achievements.map((achievement) => {
          const Icon = icons[achievement.id]
          return (
            <Card key={achievement.id} className={`achievement-card${achievement.unlocked ? ' achievement-card--unlocked' : ''}`} aria-labelledby={`achievement-${achievement.id}`}>
              <header>
                <span className="achievement-card__icon"><Icon size={24} aria-hidden="true" /></span>
                <span className="achievement-card__status">{achievement.unlocked ? <Check size={13} aria-hidden="true" /> : <LockKeyhole size={12} aria-hidden="true" />}{achievement.unlocked ? 'Conquistada' : 'Em construção'}</span>
              </header>
              <h2 id={`achievement-${achievement.id}`}>{achievement.title}</h2>
              <p>{achievement.description}</p>
              <footer>
                <div className="achievement-card__progress"><span>{Math.min(achievement.current, achievement.target)} / {achievement.target}</span><span>{achievement.unit}</span></div>
                <ProgressBar value={achievement.current / achievement.target * 100} label={`Progresso de ${achievement.title}`} />
                <small>{achievement.unlocked && achievement.achievedOn ? <>Marco nos registros de <time dateTime={achievement.achievedOn}>{displayDate(achievement.achievedOn)}</time></> : 'Sem pressa. Cada registro tem seu tempo.'}</small>
              </footer>
            </Card>
          )
        })}
      </section>
      <details className="achievements-rules">
        <summary>Como o progresso é calculado</summary>
        <p>O XP global soma somente as recompensas já salvas em registros concluídos ou parciais de hábitos. Cada 100 XP formam um nível. Conquistas não dão XP extra, e o valor atual do prêmio de um hábito não reescreve os registros anteriores.</p>
        <p>Editar ou excluir registros recalcula o progresso. As datas indicam o dia dos registros que sustentam o marco, não o momento em que a tela foi aberta. As sequências usam a agenda histórica de cada hábito: parcial, não feito ou dia previsto sem registro interrompem a sequência; dias livres e pulados não.</p>
        <p>Não há pontos por quantidade de água, duração do sono, humor ou notas de terapia. Os marcos de registro reconhecem apenas dias preenchidos, sem avaliar a qualidade da sua saúde.</p>
      </details>
    </div>
  )
}
