import { useEffect, useState } from 'react'

export default function ExportPage({ dot, onBack }) {
  const [error, setError] = useState('')

  async function copy() {
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
      <button type="button" onClick={onBack}>Back</button>
      {error && <p role="alert">{error} <button type="button" onClick={copy}>Retry copy</button></p>}
      <pre>{dot}</pre>
    </main>
  )
}
