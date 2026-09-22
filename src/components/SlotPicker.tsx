import { useMemo, useState } from 'react'
import type { Slot } from '../types'
import { formatDay, localDate, localTime, longDay } from '../lib/time'

interface Props {
  slots: Slot[]
  /** Zona horaria del profesional: días y horas se muestran en su hora local. */
  tz: string
  /** `starts_at` del horario elegido. */
  selected: string | null
  onSelect: (startsAt: string) => void
}

/** Elegir primero un día con horarios libres y después uno de sus horarios. */
export function SlotPicker({ slots, tz, selected, onSelect }: Props) {
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const s of slots) {
      const day = localDate(s.starts_at, tz)
      map.set(day, [...(map.get(day) ?? []), s])
    }
    return map
  }, [slots, tz])

  const days = [...byDay.keys()]
  const selectedDay = selected ? localDate(selected, tz) : null
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const day = pickedDay && byDay.has(pickedDay) ? pickedDay : selectedDay ?? days[0] ?? null

  if (days.length === 0) {
    return <p className="muted">No hay horarios disponibles por el momento. Volvé a intentar más adelante.</p>
  }

  return (
    <div className="slotpicker">
      <h3 className="step-title">Elegí un día</h3>
      <div className="daygrid" role="listbox" aria-label="Días disponibles">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            role="option"
            aria-selected={d === day}
            className={d === day ? 'day on' : 'day'}
            onClick={() => setPickedDay(d)}
          >
            <small>{formatDay(d, { weekday: 'short' })}</small>
            <strong>{formatDay(d, { day: 'numeric' })}</strong>
            <small>{formatDay(d, { month: 'short' })}</small>
          </button>
        ))}
      </div>

      {day && (
        <>
          <h3 className="step-title">Horarios del {longDay(day)}</h3>
          <div className="timegrid">
            {byDay.get(day)!.map((s) => (
              <button
                key={s.starts_at}
                type="button"
                className={s.starts_at === selected ? 'time on' : 'time'}
                aria-pressed={s.starts_at === selected}
                onClick={() => onSelect(s.starts_at)}
              >
                {localTime(s.starts_at, tz)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
