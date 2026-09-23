import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'

export type HeatmapPoint = {
  date: string
  classification: 'excellent' | 'partial' | 'poor' | 'none'
  percentage?: number
  completed?: number
  planned?: number
}

export function Heatmap({ points, label = 'Mapa de consistência', onSelectDate }: { points: HeatmapPoint[]; label?: string; onSelectDate?: (date: string) => void }) {
  const recorded = points.filter((point) => point.classification !== 'none').length
  const range = points.length
    ? `${format(parseISO(points[0].date), "d 'de' MMMM", { locale: ptBR })} a ${format(parseISO(points.at(-1)!.date), "d 'de' MMMM", { locale: ptBR })}`
    : 'sem período registrado'
  return (
    <figure className="heatmap-wrap">
      <figcaption className="sr-only">{label}: {recorded} de {points.length} dias com registro, de {range}.</figcaption>
      <div className="heatmap" role={onSelectDate ? 'group' : 'list'} aria-label={`${label}, detalhes por dia`}>
        {points.map((point) => {
          const readableDate = format(parseISO(point.date), "d 'de' MMMM", { locale: ptBR })
          const detail = point.classification === 'none'
            ? `${readableDate}: sem registro`
            : `${readableDate}: ${point.percentage}% (${point.completed}/${point.planned})`
          return onSelectDate ? <button key={point.date} type="button" className={clsx('heatmap__cell', `heatmap__cell--${point.classification}`)} title={detail} aria-label={detail} onClick={() => onSelectDate(point.date)} /> : (
            <span
              key={point.date}
              role="listitem"
              className={clsx('heatmap__cell', `heatmap__cell--${point.classification}`)}
              title={detail}
              aria-label={detail}
            />
          )
        })}
      </div>
      <div className="heatmap__scale" aria-hidden="true"><span>Menos</span><i /><i className="l1" /><i className="l2" /><i className="l3" /><span>Mais</span></div>
    </figure>
  )
}
