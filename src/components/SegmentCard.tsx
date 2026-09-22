import type { Sex } from '../types'
import { fatRange } from '../lib/ranges'

const FAT_SCALE_MAX = 45

interface Props {
  title: string
  sex: Sex
  leanKg: number | null
  fatPct: number | null
  active?: boolean
  onHover?: (on: boolean) => void
  className?: string
}

const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1))

export function SegmentCard({ title, sex, leanKg, fatPct, active, onHover, className = '' }: Props) {
  const [lo, hi] = fatRange(sex)
  const pct = (v: number) => `${(v / FAT_SCALE_MAX) * 100}%`
  const marker = fatPct === null ? null : `${Math.min(100, Math.max(0, (fatPct / FAT_SCALE_MAX) * 100))}%`

  return (
    <section
      className={`segment ${active ? 'active' : ''} ${className}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <h4>{title}</h4>
      <div className="zones" aria-hidden>
        <span className="z-low" style={{ width: pct(lo) }} />
        <span className="z-normal" style={{ width: pct(hi - lo) }} />
        <span className="z-high" style={{ flex: 1 }} />
        {marker && <i className="marker" style={{ left: marker }} />}
      </div>
      <dl>
        <div><dt>Masa magra</dt><dd>{fmt(leanKg)} <small>kg</small></dd></div>
        <div><dt>Grasa</dt><dd>{fmt(fatPct)} <small>%</small></dd></div>
      </dl>
    </section>
  )
}
