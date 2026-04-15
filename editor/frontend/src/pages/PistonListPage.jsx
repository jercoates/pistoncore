import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getPistons, togglePiston, deletePiston } from '../utils/api'
import './PistonListPage.css'

export default function PistonListPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [search, setSearch] = useState('')

  const { data: pistons = [], isLoading, error } = useQuery({
    queryKey: ['pistons'],
    queryFn: getPistons,
  })

  const toggleMutation = useMutation({
    mutationFn: togglePiston,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pistons'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePiston,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pistons'] }),
  })

  // Build folder list from pistons
  const folders = [...new Set(pistons.map(p => p.folder).filter(Boolean))].sort()

  const filtered = pistons.filter(p => {
    const matchFolder = !selectedFolder || p.folder === selectedFolder
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchFolder && matchSearch
  })

  const grouped = filtered.reduce((acc, p) => {
    const f = p.folder || 'Uncategorized'
    acc[f] = acc[f] || []
    acc[f].push(p)
    return acc
  }, {})

  const handleDelete = (piston) => {
    if (window.confirm(`Delete "${piston.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(piston.id)
    }
  }

  if (isLoading) return <div className="page-loading">Loading pistons...</div>
  if (error) return <div className="page-error">Could not load pistons: {error.message}</div>

  return (
    <div className="piston-list-page">
      <div className="page-header">
        <h1>My Pistons</h1>
        <button className="primary" onClick={() => navigate('/pistons/new')}>
          + New Piston
        </button>
      </div>

      <div className="list-layout">
        {/* Folder sidebar */}
        <div className="folder-sidebar">
          <button
            className={`folder-item ${!selectedFolder ? 'active' : ''}`}
            onClick={() => setSelectedFolder(null)}
          >
            All Pistons
            <span className="folder-count">{pistons.length}</span>
          </button>
          {folders.map(f => (
            <button
              key={f}
              className={`folder-item ${selectedFolder === f ? 'active' : ''}`}
              onClick={() => setSelectedFolder(f)}
            >
              {f}
              <span className="folder-count">{pistons.filter(p => p.folder === f).length}</span>
            </button>
          ))}
        </div>

        {/* Piston list */}
        <div className="piston-list-area">
          <div className="list-toolbar">
            <input
              type="text"
              placeholder="Search pistons..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              {pistons.length === 0
                ? 'No pistons yet. Click "+ New Piston" to create your first one.'
                : 'No pistons match your search.'}
            </div>
          ) : (
            Object.entries(grouped).sort().map(([folder, folderPistons]) => (
              <div key={folder} className="piston-group">
                {Object.keys(grouped).length > 1 && (
                  <div className="group-label">{folder}</div>
                )}
                {folderPistons.sort((a, b) => a.name.localeCompare(b.name)).map(piston => (
                  <div key={piston.id} className={`piston-row ${!piston.enabled ? 'disabled' : ''}`}>
                    <div className="piston-indicator" title={piston.enabled ? 'Enabled' : 'Disabled'}>
                      {piston.enabled ? '●' : '○'}
                    </div>
                    <div className="piston-info" onClick={() => navigate(`/pistons/${piston.id}`)}>
                      <div className="piston-name">{piston.name}</div>
                      {piston.description && (
                        <div className="piston-desc text-muted">{piston.description}</div>
                      )}
                      <div className="piston-meta text-dim">
                        Mode: {piston.mode}
                        {piston.last_modified && ` · Last saved: ${new Date(piston.last_modified).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="piston-actions">
                      <button
                        className="secondary"
                        onClick={() => toggleMutation.mutate(piston.id)}
                        title={piston.enabled ? 'Disable' : 'Enable'}
                      >
                        {piston.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button className="secondary" onClick={() => navigate(`/pistons/${piston.id}`)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => handleDelete(piston)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
