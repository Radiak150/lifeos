import { describe, expect, it } from 'vitest'
import { todayKey } from './date'

describe('todayKey com fuso do workspace', () => {
  it('mantem a data civil independente do fuso do dispositivo', () => {
    const instant = new Date('2026-08-13T01:30:00.000Z')
    expect(todayKey(instant, 'America/Sao_Paulo')).toBe('2026-08-12')
    expect(todayKey(instant, 'Asia/Tokyo')).toBe('2026-08-13')
  })

  it('rejeita fusos IANA invalidos', () => {
    expect(() => todayKey(new Date(), 'Mars/Olympus')).toThrow()
  })
})
