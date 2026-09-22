import { useTheme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const toLight = theme === 'dark'
  return (
    <button type="button" className="btn small" onClick={toggle} aria-label={toLight ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>
      {toLight ? '☀️ Claro' : '🌙 Oscuro'}
    </button>
  )
}
