import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, Check, Database, Inbox, LoaderCircle, Minus, X } from 'lucide-react'
import clsx from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={clsx('card', className)} {...props} />
}

export function CardHeader({
  eyebrow,
  title,
  action,
  className
}: {
  eyebrow?: string
  title: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={clsx('card-header', className)}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </header>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'icon'
}>(function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx('button', `button--${variant}`, `button--${size}`, className)}
      {...props}
    />
  )
})

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(function IconButton({ label, ...props }, ref) {
  return (
    <Button ref={ref} variant="ghost" size="icon" aria-label={label} title={label} {...props} />
  )
})

export function Badge({
  tone = 'neutral',
  children,
  className
}: {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
  children: ReactNode
  className?: string
}) {
  return <span className={clsx('badge', `badge--${tone}`, className)}>{children}</span>
}

export function ProgressBar({ value, tone = 'green', label }: { value: number; tone?: string; label?: string }) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)))
  const accessibleLabel = label ?? `Progresso: ${safeValue}%`
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={accessibleLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-valuetext={`${safeValue}%`}
    >
      <div aria-hidden="true" className="progress__fill" style={{ width: `${safeValue}%`, background: `var(--${tone})` }} />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 74,
  color = 'var(--green)',
  children,
  label
}: {
  value: number
  size?: number
  color?: string
  children?: ReactNode
  label?: string
}) {
  const safeValue = Math.min(100, Math.max(0, Math.round(value)))
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (safeValue / 100) * circumference
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" role="img" aria-label={label ?? `${safeValue}% concluído`}>
        <circle className="progress-ring__track" cx="50" cy="50" r={radius} />
        <circle
          className="progress-ring__value"
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="progress-ring__content">{children ?? <strong>{safeValue}%</strong>}</div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon = 'empty',
  action
}: {
  title: string
  description: string
  icon?: 'empty' | 'database' | 'error'
  action?: ReactNode
}) {
  const Icon = icon === 'database' ? Database : icon === 'error' ? AlertCircle : Inbox
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function LoadingScreen() {
  return (
    <main className="loading-screen">
      <div className="brand-mark brand-mark--large">L</div>
      <LoaderCircle className="spin" size={24} />
      <p>Organizando seu LifeOS…</p>
    </main>
  )
}

export function CompletionIcon({ state }: { state?: 'done' | 'partial' | 'missed' | 'skipped' }) {
  if (state === 'done') return <span className="completion completion--done"><Check size={14} /></span>
  if (state === 'partial') return <span className="completion completion--partial"><Minus size={14} /></span>
  if (state === 'missed') return <span className="completion completion--missed">×</span>
  if (state === 'skipped') return <span className="completion completion--skipped">—</span>
  return <span className="completion completion--pending" />
}

export function Field({
  label,
  hint,
  error,
  children,
  className
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('field', className)}>
      <span className="field__label">{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field__error">{error}</small>}
    </label>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  wide = false
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',')
    const getFocusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true')

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus())
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-layer__scrim" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <section ref={dialogRef} tabIndex={-1} className={clsx('modal', wide && 'modal--wide')} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </section>
    </div>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={clsx(option.value === value && 'active')}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
