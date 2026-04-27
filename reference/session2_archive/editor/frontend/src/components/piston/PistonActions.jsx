import CollapsibleSection from '../shared/CollapsibleSection'
import EntityPicker from '../shared/EntityPicker'
import './PistonActions.css'

const SIMPLE_ACTION_TYPES = [
  { value: 'call_service',  label: 'Call a service (turn on, turn off, etc.)' },
  { value: 'wait',          label: 'Wait (pause for a time or until a time)' },
  { value: 'if_then',       label: 'If / Then / Else (branch based on a condition)' },
  { value: 'log',           label: 'Log a message (for debugging)' },
  { value: 'stop',          label: 'Stop — end the piston here' },
]

const ADVANCED_ACTION_TYPES = [
  ...SIMPLE_ACTION_TYPES,
  { value: 'set_variable',   label: 'Set a variable' },
  { value: 'wait_for_state', label: 'Wait for a device to reach a state' },
  { value: 'repeat',         label: 'Repeat a block of actions' },
  { value: 'call_piston',    label: 'Call another piston' },
]

// Common HA services for quick selection
const COMMON_SERVICES = [
  'light.turn_on', 'light.turn_off', 'light.toggle',
  'switch.turn_on', 'switch.turn_off', 'switch.toggle',
  'climate.set_temperature', 'climate.set_hvac_mode',
  'media_player.play_media', 'media_player.volume_set',
  'cover.open_cover', 'cover.close_cover',
  'lock.lock', 'lock.unlock',
  'script.turn_on', 'automation.trigger',
  'notify.notify', 'persistent_notification.create',
]

function actionRoleKey(index, prefix = 'action') { return `${prefix}_device_${index}` }

export default function PistonActions({ actions, roles, deviceMap, advancedMode, onChange }) {
  const actionTypes = advancedMode ? ADVANCED_ACTION_TYPES : SIMPLE_ACTION_TYPES

  const add = () => onChange(
    [...actions, { type: 'call_service', service: '', target_role: null, data: {} }],
    roles, deviceMap
  )

  const update = (i, patch) => {
    const next = actions.map((a, idx) => idx === i ? { ...a, ...patch } : a)
    onChange(next, roles, deviceMap)
  }

  const remove = (i) => onChange(actions.filter((_, idx) => idx !== i), roles, deviceMap)

  const handleEntitySelect = (actionIndex, roleKey, entityId, friendlyName) => {
    const nextRoles = { ...roles, [roleKey]: { label: friendlyName, required: true } }
    const nextMap = { ...deviceMap, [roleKey]: entityId }
    const nextActions = actions.map((a, idx) =>
      idx === actionIndex ? { ...a, target_role: roleKey } : a
    )
    onChange(nextActions, nextRoles, nextMap)
  }

  return (
    <CollapsibleSection
      title="Actions"
      count={actions.length}
      badge={actions.length === 0 ? 'Nothing will happen when this piston runs' : undefined}
      action={{ label: '+ Add Action', onClick: add }}
    >
      {actions.length === 0 ? (
        <div className="actions-empty text-dim">
          Add actions to define what this piston does when it runs.
        </div>
      ) : (
        <div className="actions-list">
          {actions.map((action, i) => (
            <ActionRow
              key={i}
              action={action}
              index={i}
              roles={roles}
              deviceMap={deviceMap}
              actionTypes={actionTypes}
              advancedMode={advancedMode}
              onUpdate={patch => update(i, patch)}
              onRemove={() => remove(i)}
              onEntitySelect={(rk, eid, fn) => handleEntitySelect(i, rk, eid, fn)}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function ActionRow({ action, index, roles, deviceMap, actionTypes, advancedMode, onUpdate, onRemove, onEntitySelect }) {
  const roleKey = action.target_role || actionRoleKey(index)

  return (
    <div className="action-row">
      <div className="action-number">{index + 1}</div>
      <div className="action-body">
        <div className="action-type-row">
          <select
            value={action.type}
            onChange={e => onUpdate({ type: e.target.value, target_role: null, service: '' })}
            className="action-type-select"
          >
            {actionTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button className="danger" onClick={onRemove}>Remove</button>
        </div>

        {/* call_service */}
        {action.type === 'call_service' && (
          <div className="action-detail">
            <div className="inline-field">
              <label>Service</label>
              <select
                value={action.service || ''}
                onChange={e => onUpdate({ service: e.target.value })}
              >
                <option value="">— Select a service —</option>
                {COMMON_SERVICES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <EntityPicker
              roleKey={roleKey}
              roleLabel="Target device"
              entityId={deviceMap[roleKey]}
              onSelect={(rk, eid, fn) => onEntitySelect(rk, eid, fn)}
            />
            {action.service?.includes('turn_on') && (
              <div className="inline-field">
                <label>Brightness % <span className="optional">optional</span></label>
                <input
                  type="number"
                  min="0" max="100"
                  value={action.data?.brightness_pct ?? ''}
                  onChange={e => onUpdate({ data: { ...action.data, brightness_pct: parseInt(e.target.value) } })}
                  placeholder="1–100"
                />
              </div>
            )}
          </div>
        )}

        {/* wait */}
        {action.type === 'wait' && (
          <div className="action-detail">
            <div className="action-wait-choice">
              <label>
                <input
                  type="radio"
                  name={`wait_type_${index}`}
                  checked={!!action.duration_seconds && !action.until}
                  onChange={() => onUpdate({ until: null, duration_seconds: 60 })}
                />
                Wait for a duration
              </label>
              <label>
                <input
                  type="radio"
                  name={`wait_type_${index}`}
                  checked={!!action.until}
                  onChange={() => onUpdate({ duration_seconds: null, until: '23:00:00' })}
                />
                Wait until a specific time
              </label>
            </div>
            {!action.until && (
              <div className="state-fields">
                <div className="inline-field">
                  <label>Minutes</label>
                  <input
                    type="number"
                    min="0"
                    value={action.duration_seconds ? Math.floor(action.duration_seconds / 60) : ''}
                    onChange={e => onUpdate({ duration_seconds: parseInt(e.target.value) * 60 })}
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
            )}
            {action.until && (
              <div className="inline-field">
                <label>Until time</label>
                <input
                  type="time"
                  value={action.until?.slice(0, 5) || ''}
                  onChange={e => onUpdate({ until: e.target.value + ':00' })}
                />
              </div>
            )}
          </div>
        )}

        {/* if_then */}
        {action.type === 'if_then' && (
          <div className="action-detail text-muted" style={{ fontSize: 13 }}>
            If / Then / Else branches — full nested editor coming in next session.
            <br />
            <span className="text-dim">Conditions and sub-actions will be editable here.</span>
          </div>
        )}

        {/* set_variable (advanced) */}
        {action.type === 'set_variable' && advancedMode && (
          <div className="action-detail state-fields">
            <div className="inline-field">
              <label>Variable name</label>
              <input
                type="text"
                value={action.variable_name || ''}
                onChange={e => onUpdate({ variable_name: e.target.value })}
                placeholder="e.g. wasAlreadyOn"
              />
            </div>
            <div className="inline-field">
              <label>Set to</label>
              <input
                type="text"
                value={action.variable_value ?? ''}
                onChange={e => onUpdate({ variable_value: e.target.value })}
                placeholder="value or expression"
              />
            </div>
          </div>
        )}

        {/* wait_for_state (advanced) */}
        {action.type === 'wait_for_state' && advancedMode && (
          <div className="action-detail">
            <EntityPicker
              roleKey={roleKey}
              roleLabel="Wait for this device"
              entityId={deviceMap[roleKey]}
              onSelect={(rk, eid, fn) => onEntitySelect(rk, eid, fn)}
            />
            <div className="state-fields">
              <div className="inline-field">
                <label>To reach state</label>
                <input
                  type="text"
                  value={action.to_state || ''}
                  onChange={e => onUpdate({ to_state: e.target.value })}
                  placeholder="e.g. on"
                />
              </div>
              <div className="inline-field">
                <label>Timeout (seconds) <span className="optional">optional</span></label>
                <input
                  type="number"
                  value={action.timeout_seconds ?? ''}
                  onChange={e => onUpdate({ timeout_seconds: parseInt(e.target.value) })}
                  placeholder="leave blank to wait forever"
                />
              </div>
            </div>
          </div>
        )}

        {/* log */}
        {action.type === 'log' && (
          <div className="action-detail">
            <div className="inline-field" style={{ width: '100%' }}>
              <label>Message to log</label>
              <input
                type="text"
                value={action.message || ''}
                onChange={e => onUpdate({ message: e.target.value })}
                placeholder="e.g. Motion detected — turning on lights"
              />
            </div>
          </div>
        )}

        {/* stop */}
        {action.type === 'stop' && (
          <div className="action-detail text-dim" style={{ fontSize: 13 }}>
            The piston will stop here. No further actions will run.
          </div>
        )}

        {/* call_piston (advanced) */}
        {action.type === 'call_piston' && advancedMode && (
          <div className="action-detail">
            <div className="inline-field">
              <label>Target piston ID</label>
              <input
                type="text"
                value={action.target_piston_id || ''}
                onChange={e => onUpdate({ target_piston_id: e.target.value })}
                placeholder="Piston ID (from the URL when editing that piston)"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
