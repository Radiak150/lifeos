import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Compass, Layers3, Trophy, Link2, Brain, CalendarDays, ChevronLeft, ChevronRight, Home, Menu, MoonStar, Settings, Sun, Target, X } from 'lucide-react'
import clsx from 'clsx'
import { IconButton } from './ui'
import { useLifeOS } from '../app/LifeOSProvider'

const navItems = [
  { to: '/', label: 'Início', icon: Home, end: true, tone: 'green' },
  { to: '/guide', label: 'Guia de uso', icon: Compass, tone: 'neutral' },
  { to: '/today', label: 'Meu dia', icon: Sun, tone: 'yellow' },
  { to: '/calendar', label: 'Agenda', icon: CalendarDays, tone: 'blue' },
  { to: '/habits', label: 'Hábitos', icon: Target, tone: 'green' },
  { to: '/sleep', label: 'Sono', icon: MoonStar, tone: 'purple' },
  { to: '/areas', label: 'Minhas áreas', icon: Layers3, tone: 'neutral' },
  { to: '/therapy', label: 'Terapia', icon: Brain, tone: 'purple' },
  { to: '/sharing', label: 'Compartilhar', icon: Link2, tone: 'neutral' },
  { to: '/stats', label: 'Evolução', icon: BarChart3, tone: 'blue' },
  { to: '/achievements', label: 'Conquistas', icon: Trophy, tone: 'yellow' },
  { to: '/settings', label: 'Configurações', icon: Settings, tone: 'neutral' }
]
const mobileItems = [navItems[0], navItems[2], navItems[3], navItems[6]]

export default function Layout() {
  const { settings, updateSettings } = useLifeOS()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const location = useLocation()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = (event: MediaQueryListEvent) => {
      setMobileViewport(event.matches)
      if (!event.matches) setSidebarOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const scrollToSection = () => {
      const target = location.hash ? document.getElementById(location.hash.slice(1)) : null
      if (!target) return false
      target.scrollIntoView({ block: 'start', behavior: 'auto' })
      return true
    }
    let observer: MutationObserver | undefined
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      mainRef.current?.focus({ preventScroll: true })
      if (location.hash && !scrollToSection()) {
        observer = new MutationObserver(() => {
          if (scrollToSection()) observer?.disconnect()
        })
        observer.observe(mainRef.current!, { childList: true, subtree: true })
      }
    })
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!mobileViewport || !sidebarOpen) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : menuButtonRef.current
    const previousOverflow = document.body.style.overflow
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusable = () => Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => element.getClientRects().length > 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSidebarOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [mobileViewport, sidebarOpen])

  return (
    <div className={clsx('app-shell', collapsed && 'app-shell--collapsed')}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <button
        className={clsx('sidebar-scrim', sidebarOpen && 'sidebar-scrim--visible')}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        ref={sidebarRef}
        id="sidebar-drawer"
        className={clsx('sidebar', sidebarOpen && 'sidebar--open')}
        aria-label="Menu principal"
        aria-hidden={mobileViewport && !sidebarOpen ? 'true' : undefined}
        inert={mobileViewport && !sidebarOpen ? true : undefined}
      >
        <div className="sidebar__brand">
          <div className="brand-mark">L</div>
          <div className="sidebar__brand-copy">
            <strong>LIFE<span>OS</span></strong>
            <small>{settings.profile.displayName || 'Minha Rotina'}</small>
          </div>
          <IconButton ref={closeButtonRef} className="sidebar__close" label="Fechar menu" onClick={() => setSidebarOpen(false)}>
            <X size={19} />
          </IconButton>
        </div>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          {navItems.map(({ to, label, icon: Icon, end, tone }) => (
            <NavLink key={to} to={to} end={end} title={label} aria-label={label} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx('nav-item', isActive && 'nav-item--active')}>
              <Icon className={`nav-icon nav-icon--${tone}`} size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="theme-toggle" onClick={() => { void updateSettings({ appearance: { ...settings.appearance, theme: settings.appearance?.theme === 'dark' ? 'light' : 'dark' } }) }} title="Alternar tema" aria-label="Alternar tema">
          {settings.appearance?.theme === 'dark' ? <Sun size={19} /> : <MoonStar size={19} />}<span>{settings.appearance?.theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
        <IconButton
          className="sidebar__collapse"
          label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </IconButton>
      </aside>

      <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
        <header className="mobile-header">
          <button
            ref={menuButtonRef}
            className="mobile-header__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
            aria-controls="sidebar-drawer"
            aria-expanded={sidebarOpen}
          >
            <Menu size={22} />
          </button>
          <div className="mobile-header__brand"><span className="brand-mark">L</span><strong>LifeOS</strong></div>
          <NavLink to="/settings" aria-label="Abrir configurações"><Settings size={21} /></NavLink>
        </header>
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="Navegação rápida">
        {mobileItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => clsx(isActive && 'active')}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
