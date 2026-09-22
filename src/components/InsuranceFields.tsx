interface Props {
  provider: string
  plan: string
  memberId: string
  onProvider: (v: string) => void
  onPlan: (v: string) => void
  onMemberId: (v: string) => void
}

/** Fieldset de obra social/prepaga, reutilizado en el alta y en la edición de un paciente. */
export function InsuranceFields({ provider, plan, memberId, onProvider, onPlan, onMemberId }: Props) {
  return (
    <fieldset className="card">
      <legend>Obra social / prepaga</legend>
      <div className="grid g3">
        <label>Obra social o prepaga
          <input placeholder="Ej: OSDE, Swiss Medical, PAMI…" value={provider} onChange={(e) => onProvider(e.target.value)} />
        </label>
        <label>Plan
          <input placeholder="Ej: 210, Plan Azul…" value={plan} onChange={(e) => onPlan(e.target.value)} />
        </label>
        <label>N° de afiliado
          <input placeholder="Ej: 12345678/00" value={memberId} onChange={(e) => onMemberId(e.target.value)} />
        </label>
      </div>
    </fieldset>
  )
}
