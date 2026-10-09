import { NavLink, Outlet } from 'react-router'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from './ThemeToggle'

/** Secciones de la app; para agregar una, sumarla acá y crear su ruta en App.tsx. */
const SECTIONS = [
  { to: '/pacientes', label: 'Pacientes' },
  { to: '/turnos', label: 'Turnos' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/pagos', label: 'Pagos' },
  { to: '/planes', label: 'Planes' },
] as const

export function AppLayout({ email }: { email: string | undefined }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Nutrición</span>
          <nav className="sections" aria-label="Secciones">
            {SECTIONS.map((s) => (
              <NavLink key={s.to} to={s.to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {s.label}
              </NavLink>
            ))}
          </nav>
          <div className="user">
            <ThemeToggle />
            <span className="email">{email}</span>
            <button className="link" onClick={() => supabase.auth.signOut()}>Salir</button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
