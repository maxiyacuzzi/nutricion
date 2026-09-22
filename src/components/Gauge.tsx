import type { GaugeSpec } from '../lib/ranges'
import { classify } from '../lib/ranges'

const CX = 100
const CY = 100
const R = 52
const START = 135 // grados, sentido horario desde +x (abajo-izquierda)
const SWEEP = 270
const TICKS = 54

function point(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

function arc(fromDeg: number, toDeg: number, r: number) {
  const s = point(fromDeg, r)
  const e = point(toDeg, r)
  const large = toDeg - fromDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

interface Props {
  spec: GaugeSpec
  value: number | null
  decimals?: number
}

export function Gauge({ spec, value, decimals = 1 }: Props) {
  const { min, mid, max, unit } = spec
  const frac = value === null ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)))
  const level = value === null ? 'none' : classify(value, spec.healthy)
  const endAngle = START + SWEEP * frac
  const lit = Math.round(TICKS * frac)

  const minP = point(START, R + 22)
  const maxP = point(START + SWEEP, R + 22)
  const midP = point(START + SWEEP / 2, R + 20)

  return (
    <svg className={`gauge gauge-${level}`} viewBox="0 0 200 200" role="img"
      aria-label={value === null ? 'Sin dato' : `${value} ${unit}`}>
      {Array.from({ length: TICKS }, (_, i) => {
        const ang = START + (SWEEP * i) / (TICKS - 1)
        const a = point(ang, 68)
        const b = point(ang, 76)
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={i < lit ? 'tick on' : 'tick'} />
      })}
      <path d={arc(START, START + SWEEP, R)} className="track" />
      {value !== null && frac > 0 && <path d={arc(START, endAngle, R)} className="progress" />}
      <circle cx={CX} cy={CY} r="34" className="hub" />
      <text x={CX} y={CY + 2} className="value" textAnchor="middle">
        {value === null ? '—' : value.toFixed(decimals)}
      </text>
      {unit && <text x={CX} y={CY + 17} className="unit" textAnchor="middle">{unit}</text>}
      <text x={minP.x} y={minP.y} className="scale" textAnchor="middle">{min}</text>
      <text x={midP.x} y={midP.y} className="scale" textAnchor="middle">{mid}</text>
      <text x={maxP.x} y={maxP.y} className="scale" textAnchor="middle">{max}</text>
    </svg>
  )
}
