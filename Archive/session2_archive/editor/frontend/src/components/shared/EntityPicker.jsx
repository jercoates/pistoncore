import { useQuery } from '@tanstack/react-query'
import { getEntities } from '../../utils/api'
import './EntityPicker.css'

/**
 * EntityPicker
 *
 * Dropdown that shows friendly entity names grouped by domain.
 * The user never sees entity IDs — internally we store the entity_id
 * in the piston's device_map, keyed by role name.
 *
 * Props:
 *   roleKey       — the role name (e.g. "driveway_light")
 *   roleLabel     — human label shown during selection (e.g. "Driveway Light")
 *   domain        — optional domain filter (e.g. "light")
 *   entityId      — currently selected entity_id (internal, not shown)
 *   onSelect      — called with (roleKey, entityId, friendlyName)
 */
export default function EntityPicker({ roleKey, roleLabel, domain, entityId, onSelect }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['entities', domain],
    queryFn: () => getEntities(domain ? { domain } : {}),
    staleTime: 60_000,
  })

  if (isLoading) return <select disabled><option>Loading devices...</option></select>
  if (error) return <select disabled><option>Could not load devices</option></select>

  const entities = data?.entities ?? []

  // Group by domain_label for optgroup display
  const grouped = {}
  for (const e of entities) {
    grouped[e.domain_label] = grouped[e.domain_label] || []
    grouped[e.domain_label].push(e)
  }

  const handleChange = (e) => {
    const selected = entities.find(ent => ent.entity_id === e.target.value)
    if (selected) onSelect(roleKey, selected.entity_id, selected.friendly_name)
  }

  const selectedEntity = entities.find(e => e.entity_id === entityId)
  const displayValue = entityId || ''

  return (
    <div className="entity-picker">
      <label className="picker-role-label">{roleLabel}</label>
      <select value={displayValue} onChange={handleChange} className="picker-select">
        <option value="">— Select a device —</option>
        {Object.entries(grouped).sort().map(([groupLabel, items]) => (
          <optgroup key={groupLabel} label={groupLabel}>
            {items
              .sort((a, b) => a.friendly_name.localeCompare(b.friendly_name))
              .map(e => (
                <option key={e.entity_id} value={e.entity_id}>
                  {e.friendly_name}
                  {e.area_id ? ` (${e.area_id.replace(/_/g, ' ')})` : ''}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {selectedEntity && (
        <span className="picker-state text-dim">
          Current state: {selectedEntity.state}
          {selectedEntity.unit_of_measurement ? ` ${selectedEntity.unit_of_measurement}` : ''}
        </span>
      )}
    </div>
  )
}
