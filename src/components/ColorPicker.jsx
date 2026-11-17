import { useState } from 'react'
import { readColors, rememberColor } from '../storage.js'

export default function ColorPicker({ label, value, onChange }) {
  const [initial] = useState(() => {
    try {
      return { recent: readColors(), error: '' }
    } catch (cause) {
      return { recent: [], error: `Could not read color history: ${cause.message}` }
    }
  })
  const [recent, setRecent] = useState(initial.recent)
  const [error, setError] = useState(initial.error)

  function choose(color) {
    onChange(color)
    if (!color) return
    try {
      setRecent(rememberColor(color))
      setError('')
    } catch (cause) {
      setError(`Could not remember color: ${cause.message}`)
    }
  }

  return (
    <div className="field">
      <label htmlFor={`color-${label}`}>{label}</label>
      <div className="color-controls">
        <input id={`color-${label}`} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={event => choose(event.target.value)} />
        <input aria-label={`${label} value`} value={value} placeholder="Empty" onChange={event => onChange(event.target.value)} onBlur={() => { if (value) choose(value) }} />
        <button type="button" onClick={() => choose('')}>Clear</button>
      </div>
      {recent.length > 0 && (
        <div className="swatches" aria-label={`${label} recent colors`}>
          {recent.map(color => <button key={color} type="button" title={color} aria-label={`Use ${color}`} style={{ backgroundColor: color }} onClick={() => choose(color)} />)}
        </div>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  )
}
