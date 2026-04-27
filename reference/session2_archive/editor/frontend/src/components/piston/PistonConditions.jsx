import CollapsibleSection from '../shared/CollapsibleSection'
import EntityPicker from '../shared/EntityPicker'
import './PistonConditions.css'

const OPERATORS = [
  { value: 'equals',        label: 'equals' },
  { value: 'does not equal', label: 'does not equal' },
  { value: 'is greater than', label: 'is greater than' },
  { value: 'is less than',  label: 'is less than' },
  { value: 'is between',    label: 'is between' },
  { value: 'is on',         label: 'is on' },
  { value: 'is off',        label: 'is off' },
  { value: 'contains',      label: 'contains' },
  { value: 'does not contain', label: 'does not contain' },
  { value: 'is before',     label: 'is before' },
  { value: 'is after',      label: 'is after' },
]

const SIMPLE_OPS = ['is on', 'is off']
const NO_VALUE_OPS = ['is on', 'is off']

function condRoleKey(index) { return `condition_device_${index}` }

export default function PistonConditions({ conditions, roles, deviceMap, onChange }) {
  const add = () => onChange([
    ...conditions,
    { target_role: null, operator: 'is on', value: null, join: 'AND' }
  ])

  const update = (i, patch) => onChange(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c))
  const remove = (i) => onChange(conditions.filter((_, idx) => idx !== i))

  const handleEntitySelect = (condIndex, roleKey, entityId, friendlyName) => {
    // Merge into piston-level roles and device_map handled by parent
    // For conditions we just store the role key reference
    update(condIndex, { target_role: roleKey })
  }

  return (
    <CollapsibleSection
      title="Conditions"
      count={conditions.length}
      badge={conditions.length === 0 ? 'None — piston runs on every trigger' : undefined}
      action={{ label: '+ Add Condition', onClick: add }}
    >
      {conditions.length === 0 ? (
        <div className="conds-empty text-dim">
          No conditions. The piston will run every time a trigger fires.
          Add conditions to check device states or time before running.
        </div>
      ) : (
        <div className="conds-list">
          {conditions.map((cond, i) => (
            <div key={i} className="cond-row">
              {i > 0 && (
                <select
                  className="join-select"
                  value={cond.join || 'AND'}
                  onChange={e => update(i, { join: e.target.value })}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              )}

              <div className="cond-fields">
                <EntityPicker
                  roleKey={condRoleKey(i)}
                  roleLabel="Device or entity"
                  entityId={deviceMap[cond.target_role] || deviceMap[condRoleKey(i)]}
                  onSelect={(rk, eid, fn) => update(i, { target_role: rk })}
                />

                <div className="cond-op-value">
                  <div className="inline-field">
                    <label>Operator</label>
                    <select
                      value={cond.operator}
                      onChange={e => update(i, { operator: e.target.value })}
                    >
                      {OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>

                  {!NO_VALUE_OPS.includes(cond.operator) && (
                    <div className="inline-field">
                      <label>Value</label>
                      <input
                        type="text"
                        value={cond.value ?? ''}
                        onChange={e => update(i, { value: e.target.value })}
                        placeholder="e.g. on, 75, home"
                      />
                    </div>
                  )}

                  {cond.operator === 'is between' && (
                    <div className="inline-field">
                      <label>And</label>
                      <input
                        type="text"
                        value={cond.value2 ?? ''}
                        onChange={e => update(i, { value2: e.target.value })}
                        placeholder="upper value"
                      />
                    </div>
                  )}
                </div>
              </div>

              <button className="danger cond-remove" onClick={() => remove(i)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}
