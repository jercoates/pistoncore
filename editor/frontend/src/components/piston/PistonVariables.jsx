import CollapsibleSection from '../shared/CollapsibleSection'
import './PistonVariables.css'

const VARIABLE_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'yesno',    label: 'Yes / No' },
  { value: 'datetime', label: 'Date / Time' },
  { value: 'device',   label: 'Device' },
  { value: 'devices',  label: 'Devices (collection)' },
]

export default function PistonVariables({ variables, onChange }) {
  const add = () => onChange([
    ...variables,
    { name: '', type: 'text', default: null, description: '' }
  ])

  const update = (i, patch) => {
    const next = variables.map((v, idx) => idx === i ? { ...v, ...patch } : v)
    onChange(next)
  }

  const remove = (i) => onChange(variables.filter((_, idx) => idx !== i))

  return (
    <CollapsibleSection
      title="Piston Variables"
      count={variables.length}
      badge="Temporary — forgotten when this piston finishes running"
      action={{ label: '+ Add Variable', onClick: add }}
    >
      {variables.length === 0 ? (
        <div className="vars-empty text-dim">
          No variables defined. Variables are temporary — they exist only during one piston run.
        </div>
      ) : (
        <div className="vars-list">
          {variables.map((v, i) => (
            <div key={i} className="var-row">
              <input
                type="text"
                value={v.name}
                onChange={e => update(i, { name: e.target.value })}
                placeholder="Variable name"
                className="var-name"
              />
              <select
                value={v.type}
                onChange={e => update(i, { type: e.target.value })}
                className="var-type"
              >
                {VARIABLE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={v.default ?? ''}
                onChange={e => update(i, { default: e.target.value })}
                placeholder="Default value (optional)"
                className="var-default"
              />
              <button className="danger var-remove" onClick={() => remove(i)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
