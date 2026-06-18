import './CompilePreviewModal.css'

export default function CompilePreviewModal({ data, onClose }) {
  const copy = () => {
    navigator.clipboard.writeText(data.output)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Compiled output</div>
            <div className="modal-subtitle text-muted">
              Target: <strong>{data.target === 'yaml' ? 'HA Automation YAML' : 'PyScript'}</strong>
              {' · '}Filename: <strong>{data.filename}</strong>
            </div>
          </div>
          <div className="modal-actions">
            <button className="secondary" onClick={copy}>Copy</button>
            <button className="secondary" onClick={onClose}>Close</button>
          </div>
        </div>

        {data.warnings?.length > 0 && (
          <div className="modal-warnings">
            {data.warnings.map((w, i) => (
              <div key={i} className="warning-item text-warning">⚠ {w}</div>
            ))}
          </div>
        )}

        <pre className="modal-code">{data.output}</pre>
      </div>
    </div>
  )
}
