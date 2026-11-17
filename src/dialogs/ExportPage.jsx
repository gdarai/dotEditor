import { useEffect, useRef, useState } from 'react'
import useEscapeKey from '../components/useEscapeKey.js'

export default function ExportPage({ dot, onBack }) {
  const [error, setError] = useState('')
  const preRef = useRef(null)

  useEscapeKey(onBack)

  function selectAll() {
    const node = preRef.current
    if (!node) return
    const selection = window.getSelection?.()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  async function copy() {
    selectAll()
    try {
      await navigator.clipboard.writeText(dot)
      setError('')
    } catch (cause) {
      setError(`Clipboard copy failed: ${cause.message}`)
    }
  }

  useEffect(() => { copy() }, [dot])

  return (
    <main className="export-page">
      <button className="button-back" type="button" onClick={onBack}>Back</button>
      {error && <p role="alert">{error} <button type="button" onClick={copy}>Retry copy</button></p>}
      <pre ref={preRef}>{dot}</pre>
    </main>
  )
}
