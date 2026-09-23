import { describe, expect, it } from 'vitest'
import { DEFAULT_HABITS, DEFAULT_SETTINGS } from '../data/defaults'
import { makeSharedSnapshot } from './sharing'
import type { HabitLog, TherapyNote } from './types'

const date='2026-09-16', stamp=date+'T12:00:00Z'
const logs:HabitLog[]=[{id:'1',habitId:DEFAULT_HABITS[0].id,date,status:'done',note:'segredo do hábito',xpAwarded:10,updatedAt:stamp},{id:'2',habitId:DEFAULT_HABITS[0].id,date:'2026-07-01',status:'done',updatedAt:stamp},{id:'3',habitId:DEFAULT_HABITS[0].id,date:'2026-09-17',status:'done',updatedAt:stamp}]
const notes:TherapyNote[]=[{id:'1',date,content:'Nota autorizada',shared:true,authorRole:'owner',createdAt:stamp,updatedAt:stamp},{id:'2',date,content:'Nota privada',shared:false,authorRole:'owner',createdAt:stamp,updatedAt:stamp}]
const input={habits:[...DEFAULT_HABITS],habitLogs:logs,sleepLogs:[],dayCheckIns:[],therapyNotes:notes,settings:DEFAULT_SETTINGS,throughDate:date}
describe('seleção explícita para acompanhamento',()=>{
  it('não inclui nenhuma informação sem seleção',()=>{
    const result=makeSharedSnapshot(input,[],'Pessoa')
    expect(result.habits).toEqual([]);expect(result.days).toEqual([]);expect(result.notes).toEqual([])
    expect(result).not.toHaveProperty('settings');expect(result).not.toHaveProperty('profile')
  })
  it('envia apenas os 30 dias escolhidos, sem textos privados ou XP',()=>{
    const result=makeSharedSnapshot(input,['habits'],' Pessoa ')
    expect(result.alias).toBe('Pessoa');expect(result.days).toHaveLength(30)
    expect(result.habits).toEqual([{date,name:DEFAULT_HABITS[0].name,status:'done'}])
    expect(JSON.stringify(result)).not.toContain('segredo');expect(result.notes).toEqual([])
  })
  it('nota exige seleção da seção e autorização individual',()=>{
    expect(makeSharedSnapshot(input,['notes'],'').notes).toEqual([{date,content:'Nota autorizada'}])
    expect(makeSharedSnapshot(input,['sleep'],'').notes).toEqual([])
  })
  it('sono e check-in não carregam observações livres',()=>{
    const result=makeSharedSnapshot({...input,sleepLogs:[{id:'s',date,sleepStartedAt:stamp,durationMinutes:400,quality:3,note:'privado',createdAt:stamp,updatedAt:stamp}],dayCheckIns:[{id:date,date,mood:4,energy:2,note:'privado',updatedAt:stamp}]},['sleep','checkins'],'')
    expect(result.sleep).toEqual([{date,minutes:400,quality:3}]);expect(result.checkins).toEqual([{date,mood:4,energy:2,overload:null}])
    expect(JSON.stringify(result)).not.toContain('privado')
  })
})
