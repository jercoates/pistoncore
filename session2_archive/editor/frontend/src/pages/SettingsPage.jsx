import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSettings, saveSettings, testConnection } from '../utils/api'
import './SettingsPage.css'

export default function SettingsPage() {
  const [haUrl, setHaUrl] = useState('')
  const [haToken, setHaToken] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [testError, setTestError] = useState(null)
  const [statusMsg, setStatusMsg] = useState(null)

  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    onSuccess: (data) => {
      setHaUrl(data.ha_url || '')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => saveSettings({ ha_url: haUrl, ha_token: haToken }),
    onSuccess: () => {
      setStatusMsg('Settings saved.')
      setHaToken('')
      setTimeout(() => setStatusMsg(null), 3000)
    },
    onError: (e) => setStatusMsg(`Save failed: ${e.message}`),
  })

  const handleTest = async () => {
    setTestResult(null)
    setTestError(null)
    try {
      const result = await testConnection()
      setTestResult(result)
    } catch (e) {
      setTestError(e.response?.data?.detail || e.message)
    }
  }

  if (isLoading) return <div className="page-loading">Loading settings...</div>

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h2>Home Assistant Connection</h2>
        <p className="text-muted section-desc">
          PistonCore connects to your Home Assistant instance to read entity and device data,
          and to deploy compiled pistons via the PistonCore companion integration.
        </p>

        <div className="settings-field">
          <label>Home Assistant URL</label>
          <input
            type="text"
            value={haUrl}
            onChange={e => setHaUrl(e.target.value)}
            placeholder="http://homeassistant.local:8123"
          />
          <span className="field-hint text-dim">
            The URL PistonCore uses to reach your HA instance from inside Docker.
            Use an IP address if hostname resolution doesn't work.
          </span>
        </div>

        <div className="settings-field">
          <label>Long-Lived Access Token</label>
          <input
            type="password"
            value={haToken}
            onChange={e => setHaToken(e.target.value)}
            placeholder="Paste your token here to update it"
            autoComplete="off"
          />
          <span className="field-hint text-dim">
            Generate in Home Assistant: Profile → Long-Lived Access Tokens → Create Token.
            The current token is not shown for security — paste a new one only to change it.
          </span>
        </div>

        <div className="settings-actions">
          {statusMsg && <span className="status-msg">{statusMsg}</span>}
          <button className="secondary" onClick={handleTest}>Test Connection</button>
          <button
            className="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {testResult && (
          <div className="test-result success">
            <div className="test-result-title text-success">Connected to Home Assistant</div>
            <div className="test-result-detail text-muted">
              Version: {testResult.ha_version}
              {testResult.location_name && ` · Location: ${testResult.location_name}`}
            </div>
          </div>
        )}

        {testError && (
          <div className="test-result error">
            <div className="test-result-title text-error">Connection failed</div>
            <div className="test-result-detail text-muted">{testError}</div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h2>Companion Integration</h2>
        <p className="text-muted section-desc">
          The PistonCore companion integration must be installed in Home Assistant via HACS
          to allow PistonCore to write compiled piston files to your HA config directory
          and trigger reloads after deployment.
        </p>
        <div className="companion-status text-dim">
          Companion integration status check — coming in next development session.
        </div>
      </div>

      <div className="settings-section">
        <h2>About PistonCore</h2>
        <div className="about-text text-muted">
          <p>Version 0.1.0 — Early development build</p>
          <p>
            Open source under the MIT license.{' '}
            <a href="https://github.com/jercoates/pistoncore" target="_blank" rel="noreferrer">
              GitHub repository
            </a>
          </p>
          <p className="text-dim">
            PistonCore is not affiliated with Home Assistant, Nabu Casa, the original WebCoRE project, SmartThings, or Hubitat.
          </p>
        </div>
      </div>
    </div>
  )
}
