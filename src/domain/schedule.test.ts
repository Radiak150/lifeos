import { describe, expect, it } from 'vitest'
import { SYNTHETIC_SCHEDULE_ITEMS } from '../test/fixtures/routine'
import { fromDateKey } from './date'
import { getNextOccurrence, getScheduleForDate, scheduleDateTime } from './schedule'
import type { ScheduleItem } from './types'

const item = (patch: Partial<ScheduleItem>): ScheduleItem => ({ id:'schedule:test', title:'Teste', category:'therapy', recurrence:{type:'weekly',weekdays:[4]}, startTime:'14:30', active:true, protectedTime:true, createdAt:'2026-09-01T00:00:00Z', updatedAt:'2026-09-01T00:00:00Z', ...patch })

describe('agenda da rotina', () => {
  it('posiciona a madrugada depois dos blocos do dia', () => {
    const agenda = getScheduleForDate(SYNTHETIC_SCHEDULE_ITEMS, fromDateKey('2026-09-15'))
    expect(agenda[0].startTime).toBe('09:00')
    expect(agenda.at(-1)?.startTime).toBe('02:00')
    expect(agenda.at(-1)?.dayOffset).toBe(1)
  })
  it('encontra compromisso pontual distante sem limite de quatorze dias', () => {
    const session = item({ recurrence:{type:'one-off',date:'2027-01-20'} })
    expect(getNextOccurrence(session, new Date('2026-09-15T12:00:00Z'), 'America/Sao_Paulo')?.toISOString()).toBe('2027-01-20T17:30:00.000Z')
    expect(getNextOccurrence({...session,active:false},new Date('2026-09-15'))).toBeNull()
  })
  it('converte horário pelo fuso configurado, independentemente do dispositivo', () => {
    expect(scheduleDateTime(fromDateKey('2026-09-17'), '14:30', 'America/Sao_Paulo').toISOString()).toBe('2026-09-17T17:30:00.000Z')
    expect(scheduleDateTime(fromDateKey('2026-09-17'), '14:30', 'Asia/Tokyo').toISOString()).toBe('2026-09-17T05:30:00.000Z')
  })
  it('considera a madrugada da rotina anterior ao buscar o próximo evento', () => {
    const sleep = item({recurrence:{type:'daily'},startTime:'01:30',dayOffset:1})
    expect(getNextOccurrence(sleep,new Date('2026-09-15T03:20:00Z'),'America/Sao_Paulo')?.toISOString()).toBe('2026-09-15T04:30:00.000Z')
  })
  it('inclui os eventos somente nos dias semanais configurados', () => {
    expect(getScheduleForDate(SYNTHETIC_SCHEDULE_ITEMS,fromDateKey('2026-09-16')).some(entry=>entry.id==='schedule:test-weekly-a')).toBe(true)
    expect(getScheduleForDate(SYNTHETIC_SCHEDULE_ITEMS,fromDateKey('2026-09-20')).some(entry=>entry.id==='schedule:test-weekly-b')).toBe(true)
    expect(getScheduleForDate(SYNTHETIC_SCHEDULE_ITEMS,fromDateKey('2026-09-17')).some(entry=>entry.id==='schedule:test-weekly-a')).toBe(false)
  })
})
