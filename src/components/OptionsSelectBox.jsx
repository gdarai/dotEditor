export default function OptionsSelectBox({ label, value, options, onChange, required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} required={required}>
        {!required && <option value="">None</option>}
        {options.map(option => {
          const item = typeof option === 'string' ? { value: option, label: option } : option
          return <option key={item.value} value={item.value}>{item.label}</option>
        })}
      </select>
    </label>
  )
}
