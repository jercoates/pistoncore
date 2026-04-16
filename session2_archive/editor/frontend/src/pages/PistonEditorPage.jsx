import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPiston, createPiston, updatePiston, previewCompile, deployPiston } from '../utils/api'
import PistonHeader from '../components/piston/PistonHeader'
import PistonVariables from '../components/piston/PistonVariables'
import PistonTriggers from '../components/piston/PistonTriggers'
import PistonConditions from '../components/piston/PistonConditions'
import PistonActions from '../components/piston/PistonActions'
import CompilePreviewModal from '../components/piston/CompilePreviewModal'
import './PistonEditorPage.css'

const EMPTY_PISTON = {
  pistoncore_version: '1.0',
  name: 'New Piston',
  description: '',
  folder: '',
  mode: 'single',
  enabled: true,
  roles: {},
  device_map: {},
  variables: [],
  triggers: [],
  conditions: [],
  actions: [],
}

export default function PistonEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isNew = !id

  const [piston, setPiston] = useState(EMPTY_PISTON)
  const [dirty, setDirty] = useState(false)
  const [advancedMode, setAdvancedMode] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [statusMsg, setStatusMsg] = useState(null)

  const { isLoading } = useQuery({
    queryKey: ['piston', id],
    queryFn: () => getPiston(id),
    enabled: !isNew,
    onSuccess: (data) => setPiston(data),
  })

  const saveMutation = useMutation({
    mutationFn: (p) => isNew ? createPiston(p) : updatePiston(id, p),
    onSuccess: (saved) => {
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['pistons'] })
      setStatusMsg('Saved.')
      setTimeout(() => setStatusMsg(null), 3000)
      if (isNew) navigate(`/pistons/${saved.id}`, { replace: true })
    },
    onError: (err) => setStatusMsg(`Save failed: ${err.message}`),
  })

  const update = (patch) => {
    setPiston(p => ({ ...p, ...patch }))
    setDirty(true)
  }

  const handlePreview = async () => {
    if (dirty) {
      setStatusMsg('Save your piston first before previewing the compiled output.')
      return
    }
    try {
      const result = await previewCompile(piston.id)
      setPreviewData(result)
      setPreviewOpen(true)
    } catch (e) {
      setStatusMsg(`Compile error: ${e.message}`)
    }
  }

  const handleDeploy = async () => {
    if (dirty) {
      setStatusMsg('Save your piston first before deploying.')
      return
    }
    try {
      const result = await deployPiston(piston.id)
      setStatusMsg(`Deployed as ${result.filename} (${result.target})`)
    } catch (e) {
      setStatusMsg(`Deploy failed: ${e.message}`)
    }
  }

  if (!isNew && isLoading) return <div className="page-loading">Loading piston...</div>

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <button className="secondary" onClick={() => navigate('/pistons')}>
          ← My Pistons
        </button>
        <span className="editor-status">{statusMsg}</span>
        <div className="editor-toolbar-right">
          <label className="mode-toggle">
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={e => setAdvancedMode(e.target.checked)}
            />
            Advanced mode
          </label>
          <button
            className="secondary"
            onClick={() => saveMutation.mutate(piston)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : dirty ? 'Save *' : 'Save'}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <PistonHeader piston={piston} onChange={update} />

        {advancedMode && (
          <PistonVariables
            variables={piston.variables}
            onChange={variables => update({ variables })}
          />
        )}

        <PistonTriggers
          triggers={piston.triggers}
          roles={piston.roles}
          deviceMap={piston.device_map}
          onChange={(triggers, roles, deviceMap) => update({ triggers, roles, device_map: deviceMap })}
        />

        <PistonConditions
          conditions={piston.conditions}
          roles={piston.roles}
          deviceMap={piston.device_map}
          onChange={conditions => update({ conditions })}
        />

        <PistonActions
          actions={piston.actions}
          roles={piston.roles}
          deviceMap={piston.device_map}
          advancedMode={advancedMode}
          onChange={(actions, roles, deviceMap) => update({ actions, roles, device_map: deviceMap })}
        />

        <div className="editor-footer">
          <button className="secondary" onClick={handlePreview}>
            Preview compiled output
          </button>
          <button className="primary" onClick={handleDeploy}>
            Deploy to Home Assistant
          </button>
        </div>
      </div>

      {previewOpen && previewData && (
        <CompilePreviewModal data={previewData} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  )
}
