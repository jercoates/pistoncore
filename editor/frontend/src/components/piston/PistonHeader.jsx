import './PistonHeader.css'

const MODES = [
  { value: 'single', label: 'Single — ignore new triggers while running' },
  { value: 'restart', label: 'Restart — cancel current run and start fresh' },
  { value: 'queued', label: 'Queued — finish current run, then start next' },
  { value: 'parallel', label: 'Parallel — allow multiple simultaneous runs' },
]

export default function PistonHeader({ piston, onChange }) {
  return (
    <div className="piston-header-section">
      <div className="header-row">
        <div className="field-group">
          <label>Piston Name</label>
          <input
            type="text"
            value={piston.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="Give your piston a name"
          />
        </div>
        <div className="enabled-toggle">
          <label>
            <input
              type="checkbox"
              checked={piston.enabled}
              onChange={e => onChange({ enabled: e.target.checked })}
            />
            <span className={piston.enabled ? 'enabled-label on' : 'enabled-label off'}>
              {piston.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      <div className="field-group">
        <label>Description <span className="optional">optional</span></label>
        <input
          type="text"
          value={piston.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="What does this piston do?"
        />
      </div>

      <div className="header-row">
        <div className="field-group">
          <label>Folder <span className="optional">optional</span></label>
          <input
            type="text"
            value={piston.folder || ''}
            onChange={e => onChange({ folder: e.target.value })}
            placeholder="e.g. Outdoor Lighting"
          />
        </div>
        <div className="field-group">
          <label>Mode — what happens if triggered while already running</label>
          <select
            value={piston.mode}
            onChange={e => onChange({ mode: e.target.value })}
          >
            {MODES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
