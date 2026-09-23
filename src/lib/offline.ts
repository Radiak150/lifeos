import { registerSW } from 'virtual:pwa-register'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export type OfflineState = { ready: boolean; installable: boolean; installed: boolean; error: string }
let installPrompt: InstallPrompt | null = null
let state: OfflineState = { ready: false, installable: false, installed: window.matchMedia('(display-mode: standalone)').matches, error: '' }
const listeners = new Set<() => void>()
function publish(patch: Partial<OfflineState>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const getOfflineState = () => state
export async function installApp() {
  if (!installPrompt) return
  const prompt = installPrompt; installPrompt = null
  publish({ installable: false })
  try { await prompt.prompt(); await prompt.userChoice }
  catch { publish({ error: 'Use o menu do navegador para instalar o aplicativo.' }) }
}
export function prepareOffline() {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event as InstallPrompt; publish({ installable: true }) })
  window.addEventListener('appinstalled', () => publish({ installed: true, installable: false }))
  registerSW({ immediate: true, onOfflineReady: () => publish({ ready: true }), onRegisterError: () => publish({ error: 'O navegador não preparou a cópia offline. Mantenha o servidor local aberto ou tente recarregar.' }) })
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(reg => {
    if (reg.active) publish({ ready: true })
  }).catch(() => publish({ error: 'Não foi possível verificar o modo offline.' }))
}
