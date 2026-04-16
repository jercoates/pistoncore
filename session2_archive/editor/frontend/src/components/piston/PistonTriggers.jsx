import { useState } from 'react'
import CollapsibleSection from '../shared/CollapsibleSection'
import EntityPicker from '../shared/EntityPicker'
import './PistonTriggers.css'

const TRIGGER_TYPES = [
  { value: 'state',        label: 'Device or entity state change' },
  { value: 'numeric',      label: 'Numeric threshold (sensor goes above or below a value)' },
  { value: 'time',         label: 'Specific time of day' },
  { value: 'sun',          label: 'Sunrise or Sunset' },
  { value: 'time_pattern', label: 'Repeating time pattern (every X minutes)' },
  { value: 'ha_event',     label: 'Home Assistant event fires' },
  { value: 'webhook',      label: 'Incoming webhook' },
  { value: 'manual',       label: 'Manual only — run with the Test button' },
]

function roleName(index) {
  return `trigger_device_${index}`
}

export default function PistonTriggers({ triggers, roles, deviceMap, onChange }) {
  const addTrigger = () => {
    onChange(
      [...triggers, { type: 'state', target_role: null }],
      roles,
      deviceMap
    )
  }

  const updateTrigger = (i, patch) => {
    const next = triggers.map((t, idx) => idx === i ? { ...t, ...patch } : t)
    onChange(next, roles, deviceMap)
  }

  const removeTrigger = (i) => {
    onChange(triggers.filter((_, idx) => idx !== i), roles, deviceMap)
  }

  const handleEntitySelect = (triggerIndex, roleKey, entityId, friendlyName) => {
    // Add or update role
    const nextRoles = {
      ...roles,
      [roleKey]: { label: friendlyName, required: true }
    }
    const nextMap = { ...deviceMap, [roleKey]: entityId }

    // Update trigger with role key
    const nextTriggers = triggers.map((t, idx) =>
      idx === triggerIndex ? { ...t, target_role: roleKey } : t
    )
    onChange(nextTriggers, nextRoles, nextMap)
  }

  return (
    <CollapsibleSection
      title="Triggers"
      count={triggers.length}
      badge={triggers.length === 0 ? 'No triggers — piston will never run automatically' : undefined}
      action={{ label: '+ Add Trigger', onClick: addTrigger }}
    >
      {triggers.length === 0 ? (
        <div className="triggers-empty text-dim">
          Add at least one trigger to define what starts this piston.
        </div>
      ) : (
        <div className="triggers-list">
          {triggers.map((trigger, i) => (
            <TriggerRow
              key={i}
              trigger={trigger}
              index={i}
              roles={roles}
              deviceMap={deviceMap}
              onUpdate={patch => updateTrigger(i, patch)}
              onRemove={() => removeTrigger(i)}
              onEntitySelect={(roleKey, entityId, friendlyName) =>
                handleEntitySelect(i, roleKey, entityId, friendlyName)
              }
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  )
}

function TriggerRow({ trigger, index, roles, deviceMap, onUpdate, onRemove, onEntitySelect }) {
  const roleKey = trigger.target_role || roleName(index)

  return (
    <div className="trigger-row">
      <div className="trigger-controls">
        <select
          value={trigger.type}
          onChange={e => onUpdate({ type: e.target.value, target_role: null })}
          className="trigger-type-select"
        >
          {TRIGGER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="danger trigger-remove" onClick={onRemove}>Remove</button>
      </div>

      <div className="trigger-detail">
        {(trigger.type === 'state' || trigger.type === 'numeric') && (
          <div className="trigger-device-row">
            <EntityPicker
              roleKey={roleKey}
              roleLabel="Which device or entity"
              domain={undefined}
              entityId={deviceMap[roleKey]}
              onSelect={(rk, eid, fn) => onEntitySelect(rk, eid, fn)}
            />
            {trigger.type === 'state' && (
              <div className="state-fields">
                <div className="inline-field">
                  <label>Changes to state</label>
                  <input
                    type="text"
                    value={trigger.to_state || ''}
                    onChange={e => onUpdate({ to_state: e.target.value })}
                    placeholder="on / off / any"
                  />
                </div>
                <div className="inline-field">
                  <label>From state <span className="optional">optional</span></label>
                  <input
                    type="text"
                    value={trigger.from_state || ''}
                    onChange={e => onUpdate({ from_state: e.target.value })}
                    placeholder="leave blank for any"
                  />
                </div>
              </div>
            )}
            {trigger.type === 'numeric' && (
              <div className="state-fields">
                <div className="inline-field">
                  <label>Goes</label>
                  <select
                    value={trigger.direction || 'above'}
                    onChange={e => onUpdate({ direction: e.target.value })}
                  >
                    <option value="above">above</option>
                    <option value="below">below</option>
                  </select>
                </div>
                <div className="inline-field">
                  <label>Value</label>
                  <input
                    type="number"
                    value={trigger.threshold ?? ''}
                    onChange={e => onUpdate({ threshold: parseFloat(e.target.value) })}
                    placeholder="e.g. 80"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {trigger.type === 'time' && (
          <div className="inline-field">
            <label>At time</label>
            <input
              type="time"
              value={trigger.time || ''}
              onChange={e => onUpdate({ time: e.target.value })}
            />
          </div>
        )}

        {trigger.type === 'sun' && (
          <div className="state-fields">
            <div className="inline-field">
              <label>Event</label>
              <select
                value={trigger.event || 'sunset'}
                onChange={e => onUpdate({ event: e.target.value })}
              >
                <option value="sunrise">Sunrise</option>
                <option value="sunset">Sunset</option>
              </select>
            </div>
            <div className="inline-field">
              <label>Offset (minutes before/after)</label>
              <input
                type="number"
                value={trigger.offset_minutes ?? 0}
                onChange={e => onUpdate({ offset_minutes: parseInt(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {trigger.type === 'time_pattern' && (
          <div className="state-fields">
            <div className="inline-field">
              <label>Every</label>
              <input
                type="number"
                value={trigger.every_minutes || trigger.every_hours || ''}
                onChange={e => onUpdate({ every_minutes: parseInt(e.target.value) })}
                placeholder="e.g. 30"
                min="1"
              />
            </div>
            <div className="inline-field">
              <label>Unit</label>
              <select
                value={trigger.every_hours ? 'hours' : 'minutes'}
                onChange={e => {
                  if (e.target.value === 'hours') {
                    onUpdate({ every_hours: trigger.every_minutes || 1, every_minutes: undefined })
                  } else {
                    onUpdate({ every_minutes: trigger.every_hours || 30, every_hours: undefined })
                  }
                }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </select>
            </div>
          </div>
        )}

        {trigger.type === 'ha_event' && (
          <div className="inline-field">
            <label>Event type</label>
            <input
              type="text"
              value={trigger.event_type || ''}
              onChange={e => onUpdate({ event_type: e.target.value })}
              placeholder="e.g. state_changed"
            />
          </div>
        )}

        {trigger.type === 'webhook' && (
          <div className="inline-field">
            <label>Webhook ID</label>
            <input
              type="text"
              value={trigger.webhook_id || ''}
              onChange={e => onUpdate({ webhook_id: e.target.value })}
              placeholder="e.g. pistoncore_my_webhook"
            />
          </div>
        )}

        {trigger.type === 'manual' && (
          <div className="text-dim" style={{ fontSize: 13 }}>
            This piston only runs when you click the Test button. No automatic trigger.
          </div>
        )}
      </div>
    </div>
  )
}
