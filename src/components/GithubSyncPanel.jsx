import { useState } from 'react'
import { DEFAULT_GITHUB_SYNC } from '../services/githubSync'

const tokenUrl = 'https://github.com/settings/personal-access-tokens/new'

function SyncStatus({ status }) {
  const labels = {
    disconnected: 'Not connected',
    connecting: 'Connecting…',
    syncing: 'Saving…',
    pending: 'Changes pending',
    synced: 'Synced',
    conflict: 'Needs attention',
    error: 'Sync error',
  }

  return <span className={`sync-status sync-${status}`}><i />{labels[status] || labels.disconnected}</span>
}

function GithubSyncPanel({ config, status, message, lastSyncedAt, onConnect, onPull, onPush, onDisconnect }) {
  const [token, setToken] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const busy = status === 'connecting' || status === 'syncing'

  const connect = (mode) => {
    if (!token.trim()) return
    onConnect(token.trim(), mode)
  }

  return (
    <section className="panel github-sync-panel">
      <div className="panel-heading sync-heading">
        <div>
          <span className="eyebrow">Private cloud data</span>
          <h2>GitHub sync</h2>
          <p>Keep the same cash-flow data on every device.</p>
        </div>
        <SyncStatus status={status} />
      </div>

      {config ? (
        <div className="sync-connected">
          <div className="sync-repository">
            <span>Private data repository</span>
            <strong>{config.owner}/{config.repo}</strong>
            <small>{lastSyncedAt ? `Last saved ${lastSyncedAt}` : 'Automatic saving is enabled'}</small>
          </div>
          {message && <p className={`sync-message ${status === 'error' || status === 'conflict' ? 'sync-message-error' : ''}`}>{message}</p>}
          <div className="sync-actions">
            <button className="button-secondary button-small" type="button" onClick={onPull} disabled={busy}>Pull latest</button>
            <button className="button-secondary button-small" type="button" onClick={onPush} disabled={busy}>Save now</button>
            <button className="button-quiet button-small" type="button" onClick={onDisconnect} disabled={busy}>Disconnect</button>
          </div>
        </div>
      ) : (
        <div className="sync-setup">
          <div className="sync-explainer">
            <div><strong>1</strong><span>Create a fine-grained token for <b>{DEFAULT_GITHUB_SYNC.repo}</b> with Contents read/write access.</span></div>
            <div><strong>2</strong><span>Paste it below. The token stays only in this browser and is never added to your repository.</span></div>
          </div>
          <button className="setup-toggle" type="button" onClick={() => setShowSetup((current) => !current)}>{showSetup ? 'Hide token setup' : 'Show token setup'}</button>
          {showSetup && (
            <div className="token-help">
              <p>On GitHub, choose repository access <b>Only select repositories</b> → <b>{DEFAULT_GITHUB_SYNC.repo}</b>, then set <b>Repository permissions → Contents → Read and write</b>.</p>
              <a href={tokenUrl} target="_blank" rel="noreferrer">Create fine-grained token ↗</a>
            </div>
          )}
          <label className="token-field">
            <span>Fine-grained GitHub token</span>
            <input type="password" value={token} autoComplete="off" placeholder="github_pat_…" onChange={(event) => setToken(event.target.value)} />
          </label>
          {message && <p className="sync-message sync-message-error">{message}</p>}
          <div className="sync-choice-grid">
            <button className="button-primary" type="button" disabled={!token.trim() || busy} onClick={() => connect('upload')}>
              <span>First device</span>
              <strong>Upload this device</strong>
              <small>Use the data already shown here</small>
            </button>
            <button className="button-secondary" type="button" disabled={!token.trim() || busy} onClick={() => connect('download')}>
              <span>Another device</span>
              <strong>Download GitHub data</strong>
              <small>Replace this device with the saved copy</small>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default GithubSyncPanel
