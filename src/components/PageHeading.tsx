import type { ReactNode } from 'react'

export function PageHeading({ title, description, eyebrow, actions }: { title: string; description: string; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="page-heading">
      <div className="page-heading__copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-heading__actions">{actions}</div>}
    </header>
  )
}
