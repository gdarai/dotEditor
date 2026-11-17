import { useState } from 'react'
import { loadGraph, saveGraph } from '../api.js'
import { inspectGraph } from '../graph/dot.js'
import useEscapeKey from '../components/useEscapeKey.js'
import useAutoFocus from '../components/useAutoFocus.js'

export default function ConfigDialog({
  dot, graphName, apiUrl, apiKey, layout, onChange, onCreate, onLoad, onExport, onClose,
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const dialogRef = useAutoFocus()

  useEscapeKey(onClose, Boolean(dot))

  async function run(action, success) {
    setBusy(true)
    setMessage('')
    try {
      await action()
      if (success) setMessage(success)
    } catch (cause) {
      setMessage(cause.message)
    } finally {
      setBusy(false)
    }
  }

  const config = { url: apiUrl, graphName, apiKey }

  return (
    <section className="dialog" role="dialog" aria-modal="true" aria-label="Config" ref={dialogRef}>
      <h2>Config</h2>
      <div className="fields">
        <label className="field">Display
          <select value={layout} onChange={event => onChange('layout', event.target.value)}>
            <option value="auto">Auto</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
          </select>
        </label>
        <label className="field">Graph name
          <input value={graphName} onChange={event => onChange('graphName', event.target.value)} />
        </label>
        <label className="field">API URL
          <input type="url" value={apiUrl} placeholder="https://example.com/api" onChange={event => onChange('apiUrl', event.target.value)} />
        </label>
        <label className="field">API key
          <input type="password" value={apiKey} autoComplete="off" onChange={event => onChange('apiKey', event.target.value)} />
        </label>
      </div>
      <div className="actions">
        {!dot && <button type="button" disabled={busy} onClick={onCreate}>New graph</button>}
        <button type="button" disabled={busy || !dot} onClick={() => run(() => saveGraph({ ...config, dot }), 'Saved to web storage')}>Save</button>
        <button type="button" disabled={busy} onClick={() => run(async () => {
          const loaded = await loadGraph(config)
          inspectGraph(loaded)
          onLoad(loaded)
        })}>Load</button>
        <button type="button" disabled={!dot || busy} onClick={onExport}>Export</button>
      </div>
      {message && <p role="status">{message}</p>}
      {dot && <div className="card-footer"><button type="button" onClick={onClose}>Back</button></div>}
    </section>
  )
}
