import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGlobals, saveGlobals } from '../utils/api'
import './GlobalsPage.css'

const VARIABLE_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'yesno',    label: 'Yes / No' },
  { value: 'datetime', label: 'Date / Time' },
  { value: 'device',   label: 'Device' },
  { value: 'devices',  label: 'Devices (collection)' },
]

export default function GlobalsPage() {
  const qc = useQueryClient()
  const [statusMsg, setStatusMsg] = useState(null)

  const { data: globals = [], isLoading } = useQuery({
    queryKey: ['globals'],
    queryFn: getGlobals,
  })

  const [draft, setDraft] = useState(null)

  // Use draft if user has made changes, else use fetched data
  const items = draft ?? globals

  const saveMutation = useMutation({
    mutationFn: saveGlobals,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['globals'] })
      setStatusMsg('Global variables saved.')
      setTimeout(() => setStatusMsg(null), 3000)
      setDraft(null)
    },
  })

  const update = (updatedItems) => setDraft(updatedItems)

  const add = () => update([
    ...items,
    { name: '', type: 'text', value: null, description: '' }
  ])

  const updateItem = (i, patch) => update(items.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const remove = (i) => update(items.filter((_, idx) => idx !== i))

  const dirty = draft !== null

  if (isLoading) return <div className="page-loading">Loading global variables...</div>

  return (
    <div className="globals-page">
      <div className="page-header">
        <div>
          <h1>Global Variables</h1>
          <p className="text-muted page-subtitle">
            House-level values shared across all pistons. Change a global once — every piston that uses it updates automatically.
          </p>
        </div>
        <div className="page-header-actions">
          {statusMsg && <span className="status-msg">{statusMsg}</span>}
          <button className="secondary" onClick={add}>+ Add Variable</button>
          <button
            className="primary"
            onClick={() => saveMutation.mutate(items)}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : dirty ? 'Save Changes *' : 'Save Changes'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="globals-empty">
          <p>No global variables defined yet.</p>
          <p className="text-dim">
            Examples: a "House Mode" text variable ("home", "away", "night"),
            a "Announcement Speakers" Devices variable, or a "Low Battery Threshold" number.
          </p>
          <button className="secondary" onClick={add}>Add your first global variable</button>
        </div>
      ) : (
        <div className="globals-list">
          <div className="globals-header-row">
            <span>Name</span>
            <span>Type</span>
            <span>Current Value</span>
            <span>Description</span>
            <span></span>
          </div>
          {items.map((g, i) => (
            <div key={i} className="global-row">
              <input
                type="text"
                value={g.name}
                onChange={e => updateItem(i, { name: e.target.value })}
                placeholder="variableName"
                className="global-name"
              />
              <select
                value={g.type}
                onChange={e => updateItem(i, { type: e.target.value })}
                className="global-type"
              >
                {VARIABLE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={g.value ?? ''}
                onChange={e => updateItem(i, { value: e.target.value })}
                placeholder="Value"
                className="global-value"
              />
              <input
                type="text"
                value={g.description || ''}
                onChange={e => updateItem(i, { description: e.target.value })}
                placeholder="What is this for?"
                className="global-desc"
              />
              <button className="danger" onClick={() => remove(i)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
