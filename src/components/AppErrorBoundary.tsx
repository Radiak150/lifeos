import { Component, type ReactNode } from 'react'
import { Button, EmptyState } from './ui'

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <main className="fatal-state"><EmptyState icon="error" title="Vamos reabrir o LifeOS" description="A tela encontrou um erro. Seus registros salvos continuam neste dispositivo." action={<Button onClick={() => window.location.reload()}>Reabrir aplicativo</Button>} /></main>
    return this.props.children
  }
}
