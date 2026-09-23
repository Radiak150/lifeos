import { useCallback, useEffect, useState } from 'react'

export type StoragePersistenceState = {
  supported: boolean
  persisted: boolean | null
  usage: number | null
  quota: number | null
  checking: boolean
}

const initialState: StoragePersistenceState = {
  supported: typeof navigator !== 'undefined' && Boolean(navigator.storage),
  persisted: null,
  usage: null,
  quota: null,
  checking: true
}

/** Expõe o estado real do armazenamento do navegador, sem presumir persistência. */
export function usePersistentStorage() {
  const [state, setState] = useState<StoragePersistenceState>(initialState)

  const refresh = useCallback(async () => {
    if (!navigator.storage) {
      setState({ supported: false, persisted: null, usage: null, quota: null, checking: false })
      return
    }
    try {
      const [persisted, estimate] = await Promise.all([
        navigator.storage.persisted?.() ?? Promise.resolve(false),
        navigator.storage.estimate?.() ?? Promise.resolve({})
      ])
      setState({
        supported: true,
        persisted,
        usage: typeof estimate.usage === 'number' ? estimate.usage : null,
        quota: typeof estimate.quota === 'number' ? estimate.quota : null,
        checking: false
      })
    } catch {
      setState((current) => ({ ...current, supported: true, checking: false }))
    }
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void refresh() })
    return () => window.cancelAnimationFrame(frame)
  }, [refresh])

  const requestPersistence = useCallback(async () => {
    if (!navigator.storage?.persist) return false
    const granted = await navigator.storage.persist()
    await refresh()
    return granted
  }, [refresh])

  return { ...state, refresh, requestPersistence }
}
