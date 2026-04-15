import { useState } from 'react'
import './CollapsibleSection.css'

export default function CollapsibleSection({ title, count, badge, children, defaultOpen = true, action }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="collapsible-section">
      <div className="section-header" onClick={() => setOpen(o => !o)}>
        <span className="section-chevron">{open ? '▼' : '▶'}</span>
        <span className="section-title">{title}</span>
        {count !== undefined && <span className="section-count">{count}</span>}
        {badge && <span className="section-badge">{badge}</span>}
        {action && (
          <span
            className="section-action"
            onClick={e => { e.stopPropagation(); action.onClick() }}
          >
            {action.label}
          </span>
        )}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}
