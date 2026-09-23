import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, getDaysInMonth, isSameDay, isSameMonth, setDate, startOfMonth, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { Button, IconButton } from './ui'

export type DayVisualState = {
  classification: 'excellent' | 'partial' | 'poor' | 'none'
  percentage?: number
  planned?: number
  completed?: number
  hasTherapy?: boolean
}

export function MonthCalendar({
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  getDayState,
  today = new Date(),
  weekStartsOn = 0,
  thresholds = { excellentAt: 75, partialAt: 50 },
  compact = false
}: {
  month: Date
  selectedDate: Date
  onMonthChange: (month: Date) => void
  onSelectDate: (date: Date) => void
  getDayState: (date: Date) => DayVisualState
  today?: Date
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  thresholds?: { excellentAt: number; partialAt: number }
  compact?: boolean
}) {
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const selectMonth = (offset: number) => {
    const nextMonth = addMonths(startOfMonth(month), offset)
    const nextSelection = setDate(nextMonth, Math.min(selectedDate.getDate(), getDaysInMonth(nextMonth)))
    onMonthChange(nextMonth)
    onSelectDate(nextSelection)
  }

  return (
    <div className={clsx('month-calendar', compact && 'month-calendar--compact')}>
      <div className="month-calendar__toolbar">
        <IconButton label="Mês anterior" onClick={() => selectMonth(-1)}><ChevronLeft size={18} /></IconButton>
        <h2 aria-live="polite" aria-atomic="true">{format(month, 'MMMM / yyyy', { locale: ptBR })}</h2>
        <div className="month-calendar__toolbar-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onMonthChange(today)
              onSelectDate(today)
            }}
          >Hoje</Button>
          <IconButton label="Próximo mês" onClick={() => selectMonth(1)}><ChevronRight size={18} /></IconButton>
        </div>
      </div>

      <div className="month-calendar__weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, offset) => ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][(weekStartsOn + offset) % 7]).map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="month-calendar__grid">
        {days.map((day) => {
          const state = getDayState(day)
          const outside = !isSameMonth(day, month)
          const selected = isSameDay(day, selectedDate)
          const current = isSameDay(day, today)
          const weekend = day.getDay() === 0 || day.getDay() === 6
          const label = `${format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}: ${
            state.classification === 'none' ? 'sem registro' : `${state.percentage ?? 0}% concluído`
          }${state.planned != null ? `, ${state.completed ?? 0} de ${state.planned} hábitos concluídos` : ''}${state.hasTherapy ? ', terapia agendada' : ''}`

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={clsx(
                'calendar-day',
                outside && 'calendar-day--outside',
                selected && 'calendar-day--selected',
                current && 'calendar-day--today',
                weekend && 'calendar-day--weekend',
                `calendar-day--${state.classification}`
              )}
              onClick={() => onSelectDate(day)}
              aria-label={label}
              aria-pressed={selected}
              aria-current={current ? 'date' : undefined}
              title={label}
            >
              <span className="calendar-day__number">{format(day, 'd')}</span>
              <span className="calendar-day__status" />
              {state.hasTherapy && <span className="calendar-day__therapy" aria-hidden="true" title="Terapia" />}
            </button>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span><i className="legend-dot legend-dot--excellent" />Excelente ({thresholds.excellentAt}%+)</span>
        <span><i className="legend-dot legend-dot--partial" />Parcial ({thresholds.partialAt}–{thresholds.excellentAt - 1}%)</span>
        <span><i className="legend-dot legend-dot--poor" />Difícil (&lt;{thresholds.partialAt}%)</span>
        <span><i className="legend-dot legend-dot--none" />Sem registro</span>
      </div>
    </div>
  )
}
