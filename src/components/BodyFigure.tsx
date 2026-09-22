import type { Sex } from '../types'
import { LAYOUT, segmentLayers, type SegmentData, type SegmentId } from '../lib/bodyShape'

export type { SegmentId, SegmentData }

interface Props {
  sex: Sex
  segments: Record<SegmentId, SegmentData>
  active: SegmentId | null
  onHover?: (id: SegmentId | null) => void
}

/**
 * Silueta frontal que se deforma con los datos: el núcleo azul crece con los kg de músculo
 * del segmento y la capa ámbar que lo rodea crece con su % de grasa.
 * "Izquierda/derecha" son las del paciente (lado opuesto en pantalla).
 */
export function BodyFigure({ sex, segments, active, onHover }: Props) {
  const { cx, shoulderY, hipY } = LAYOUT
  const L = (id: SegmentId) => segmentLayers(id, sex, segments[id])
  const trunk = L('trunk')
  const armX = trunk.edge + 8

  const parts: { id: SegmentId; transform: string }[] = [
    { id: 'rightLeg', transform: `translate(${cx - 19} ${hipY}) rotate(1.2)` },
    { id: 'leftLeg', transform: `translate(${cx + 19} ${hipY}) rotate(-1.2)` },
    { id: 'rightArm', transform: `translate(${cx - armX} ${shoulderY + 2}) rotate(6)` },
    { id: 'leftArm', transform: `translate(${cx + armX} ${shoulderY + 2}) rotate(-6)` },
    { id: 'trunk', transform: `translate(${cx} ${shoulderY})` },
  ]

  return (
    <figure className="body-figure">
      <svg viewBox="0 0 200 400" role="img" aria-label="Silueta corporal según grasa y músculo">
        <g className="base">
          <ellipse cx={cx} cy="34" rx="16" ry="19" />
          <path d={`M ${cx - 7} 48 Q ${cx} 58 ${cx + 7} 48 L ${cx + 8} 70 L ${cx - 8} 70 Z`} />
        </g>
        {parts.map(({ id, transform }) => {
          const l = id === 'trunk' ? trunk : L(id)
          return (
            <g
              key={id}
              transform={transform}
              className={`seg ${active === id ? 'hot' : ''}`}
              onMouseEnter={() => onHover?.(id)}
              onMouseLeave={() => onHover?.(null)}
            >
              <path d={l.outer} className="fat" style={{ fillOpacity: l.fatOpacity }} />
              <path d={l.core} className="muscle" />
            </g>
          )
        })}
      </svg>
      <figcaption>
        <span><i className="sw fat" /> Grasa</span>
        <span><i className="sw muscle" /> Músculo</span>
      </figcaption>
    </figure>
  )
}
