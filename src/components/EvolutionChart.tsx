import { useId, useState } from 'react'

export interface EvolutionPoint {
  date: string // ISO
  value: number
}

interface Props {
  title: string
  unit: string
  /** Color de la serie: var(--token) o un hex ya validado para ambos temas. */
  color: string
  points: EvolutionPoint[]
  decimals?: number
}

const W = 320
const H = 160
const PAD_X = 8
const PAD_TOP = 14
const PAD_BOTTOM = 22

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso))

/** Redondea a un "número limpio": 1, 2, 2.5, 5 × 10^n. */
function niceStep(rough: number): number {
  if (rough <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  return step * mag
}

/** Línea de evolución de un único indicador a lo largo del tiempo (small multiple: un color, sin leyenda). */
export function EvolutionChart({ title, unit, color, points, decimals = 1 }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId()

  if (points.length < 2) {
    const last = points[0]
    return (
      <div className="evo-card">
        <h4>{title}</h4>
        <p className="muted small">
          {last
            ? `Todavía hay una sola medición (${last.value.toFixed(decimals)} ${unit}). Hacen falta al menos 2 para ver una evolución.`
            : 'Sin datos todavía.'}
        </p>
      </div>
    )
  }

  const t0 = new Date(points[0].date).getTime()
  const t1 = new Date(points[points.length - 1].date).getTime()
  const span = Math.max(t1 - t0, 1)
  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const step = niceStep((rawMax - rawMin) / 3 || rawMax * 0.1 || 1)
  const min = Math.floor(rawMin / step) * step - (rawMin === rawMax ? step : 0)
  const max = Math.ceil(rawMax / step) * step + (rawMax === rawMin ? step : 0)
  const ticks = [min, (min + max) / 2, max]

  const x = (t: number) => PAD_X + ((t - t0) / span) * (W - 2 * PAD_X)
  const y = (v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * (H - PAD_TOP - PAD_BOTTOM)

  const coords = points.map((p) => ({ ...p, cx: x(new Date(p.date).getTime()), cy: y(p.value) }))
  const line = coords.map((c) => `${c.cx},${c.cy}`).join(' L')
  const area = `M${coords[0].cx},${y(min)} L${line} L${coords[coords.length - 1].cx},${y(min)} Z`
  const active = hover !== null ? coords[hover] : null
  const last = coords[coords.length - 1]
  const first = coords[0]
  const delta = last.value - first.value

  return (
    <div className="evo-card">
      <div className="evo-head">
        <h4>{title}</h4>
        <span className={`evo-delta ${delta === 0 ? '' : delta > 0 ? 'up' : 'down'}`}>
          {delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(decimals)}`} {unit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución de ${title}: de ${first.value.toFixed(decimals)} a ${last.value.toFixed(decimals)} ${unit}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_X} x2={W - PAD_X} y1={y(t)} y2={y(t)} className="evo-grid" />
            <text x={0} y={y(t) - 2} className="evo-tick">{t.toFixed(decimals)}</text>
          </g>
        ))}

        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} stroke="none" />
        <path d={`M${line}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {active && <line x1={active.cx} x2={active.cx} y1={PAD_TOP} y2={H - PAD_BOTTOM} className="evo-crosshair" />}

        {/* Punto final: etiqueta directa con el último valor. */}
        <circle cx={last.cx} cy={last.cy} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
        <text x={Math.min(last.cx, W - 30)} y={last.cy - 9} className="evo-endlabel" textAnchor="middle">
          {last.value.toFixed(decimals)}
        </text>

        {coords.map((c, i) => (
          <g key={c.date}>
            {hover === i && <circle cx={c.cx} cy={c.cy} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />}
            {/* Blanco transparente: sólo amplía el área de interacción del punto. */}
            <circle
              cx={c.cx} cy={c.cy} r={14} fill="transparent" tabIndex={0}
              aria-label={`${fmtDay(c.date)}: ${c.value.toFixed(decimals)} ${unit}`}
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            />
          </g>
        ))}

        <text x={first.cx} y={H - 6} className="evo-tick" textAnchor="start">{fmtDay(first.date)}</text>
        <text x={last.cx} y={H - 6} className="evo-tick" textAnchor="end">{fmtDay(last.date)}</text>
      </svg>

      {active && (
        <div className="evo-tooltip" style={{ left: `${(active.cx / W) * 100}%` }}>
          <strong>{active.value.toFixed(decimals)} {unit}</strong>
          <span>{fmtDay(active.date)}</span>
        </div>
      )}
    </div>
  )
}
