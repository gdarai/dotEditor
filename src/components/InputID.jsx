import { useId } from 'react'

export default function InputID({ label, value, options, onChange, required = false }) {
  const listId = useId()

  return (
    <label className="field">
      {label}
      <input list={listId} required={required} value={value} onChange={event => onChange(event.target.value)} />
      <datalist id={listId}>
        {[...new Set(options)].map(id => <option key={id} value={id} />)}
      </datalist>
    </label>
  )
}
