import { useEffect, useRef, useState } from 'react'
import { readColors, rememberColor } from '../storage.js'

export default function ColorPicker({ label, value, onChange }) {
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [initial] = useState(() => {
    try {
      return { recent: readColors(), error: '' }
    } catch (cause) {
      return { recent: [], error: `Could not read color history: ${cause.message}` }
    }
  })
  const [recent, setRecent] = useState(initial.recent)
  const [error, setError] = useState(initial.error)

  function openPopup() {
    try {
      setRecent(readColors())
      setError('')
    } catch (cause) {
      setError(`Could not read color history: ${cause.message}`)
    }
    setOpen(true)
  }

  function closePopup() {
    setOpen(false)
    if (!value) return
    try {
      setRecent(rememberColor(value))
      setError('')
    } catch (cause) {
      setError(`Could not remember color: ${cause.message}`)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) closePopup()
    }
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closePopup()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open, value])

  return (
    <div className="field color-field" ref={containerRef}>
      <span>{label}</span>
      <div className="color-controls">
        <button ref={triggerRef} type="button" aria-label={`Choose ${label}`} aria-expanded={open} onClick={() => open ? closePopup() : openPopup()} style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(value) ? value : undefined }} />
        <input aria-label={`${label} value`} value={value} placeholder="Empty" onChange={event => onChange(event.target.value)} />
        <button type="button" onClick={() => onChange('')}>Clear</button>
      </div>
      {open && (
        <div className="color-popup" role="dialog" aria-label={`${label} color picker`}>
          <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={event => onChange(event.target.value)} />
          <div className="swatches" aria-label={`${label} recent colors`}>
            {recent.map(color => <button key={color} type="button" title={color} aria-label={`Use ${color}`} style={{ backgroundColor: color }} onClick={() => onChange(color)} />)}
          </div>
          <button type="button" onClick={closePopup}>Close</button>
        </div>
      )}
      {error && <span role="alert">{error}</span>}
    </div>
  )
}
