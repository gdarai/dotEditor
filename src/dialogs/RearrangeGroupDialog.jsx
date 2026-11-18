import { useState } from 'react'
import { inspectGraph, rearrangeGroup } from '../graph/dot.js'
import useAutoFocus from '../components/useAutoFocus.js'
import useEscapeKey from '../components/useEscapeKey.js'

export default function RearrangeGroupDialog({ dot, onCommit, onBack }) {
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('')
  const [pending, setPending] = useState({})
  const [error, setError] = useState('')
  const dialogRef = useAutoFocus([selected])
  const graph = inspectGraph(dot)
  const groups = graph.groups
  const ancestors = new Set()
  let parent = selected
  while (parent) {
    ancestors.add(parent.location.start.offset)
    parent = groups.find(group => group.location.start.offset === parent.parentLocation?.start.offset)
  }
  const entries = [
    ...graph.nodes.map(item => ({ type: 'node', item, label: `Node ${item.id}${item.implicit ? ' (implicit)' : ''}` })),
    ...graph.edges.map(item => ({
      type: 'edge', item,
      label: item.complex
        ? `Arrow ${dot.slice(item.location.start.offset, item.location.end.offset).trim()} (complex)`
        : `Arrow ${item.source} ${graph.directed ? '→' : '—'} ${item.target}`,
    })),
    ...groups.filter(item => !ancestors.has(item.location.start.offset))
      .map(item => ({ type: 'group', item, label: `Group ${item.id}` })),
  ]
  const keyFor = entry => `${entry.type}:${entry.item.location.start.offset}`
  const isInGroup = entry => entry.item.parentLocation?.start.offset === selected?.location.start.offset
  const isSelected = entry => pending[keyFor(entry)] ?? isInGroup(entry)
  const statusFor = entry => isSelected(entry)
    ? 'In the group'
    : entry.item.parentId ? `In ${entry.item.parentId}` : 'Not in the group'
  const visible = entries.filter(entry => entry.label.toLowerCase().includes(filter.toLowerCase()))

  function back() {
    if (!selected) onBack()
    else {
      setSelected(null)
      setPending({})
      setFilter('')
      setError('')
    }
  }
  useEscapeKey(back)

  function changeAll() {
    if (!visible.length) return
    const add = visible.some(entry => !isSelected(entry))
    setPending(current => ({
      ...current,
      ...Object.fromEntries(visible.map(entry => [keyFor(entry), add])),
    }))
  }

  function submit() {
    try {
      const changes = entries.filter(entry => isSelected(entry) !== isInGroup(entry))
        .map(entry => ({ type: entry.type, location: entry.item.location, inGroup: isSelected(entry) }))
      onCommit(rearrangeGroup(dot, selected.location, changes))
      setError('')
      onBack()
    } catch (cause) {
      setError(cause.message)
    }
  }

  return (
    <section className="dialog edit-dialog" role="dialog" aria-modal="true" aria-label="Rearrange Group" ref={dialogRef}>
      <h2>{selected ? `Rearrange ${selected.id}` : 'Rearrange Group'}</h2>
      {!selected ? (
        <div className="selection-list" aria-label="Select group">
          {!groups.length && <p>No groups to rearrange.</p>}
          {groups.map(group => <button key={group.location.start.offset} type="button" onClick={() => { setSelected(group); setError('') }}>{group.id}</button>)}
        </div>
      ) : <>
        <div className="rearrange-filter">
          <label className="field">Filter
            <input value={filter} onChange={event => setFilter(event.target.value)} onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); changeAll() }
            }} />
          </label>
          <button type="button" disabled={!visible.length} onClick={changeAll} onKeyDown={event => {
            if (event.key === 'Enter') event.preventDefault()
          }}>Change</button>
        </div>
        <div className="selection-list" aria-label="Rearrange elements">
          {!visible.length && <p>No matching elements.</p>}
          {visible.map(entry => <button className="rearrange-row" key={keyFor(entry)} type="button"
            aria-pressed={isSelected(entry)}
            onClick={() => setPending(current => ({ ...current, [keyFor(entry)]: !isSelected(entry) }))}>
            <span>{entry.label}</span><span>{statusFor(entry)}</span>
          </button>)}
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="card-footer" role="group" aria-label="Dialog actions">
        {selected && <button className="button-apply" type="button" onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') event.preventDefault()
        }} onClick={event => { if (event.detail > 0) submit() }}>Submit</button>}
        <button className="button-back" type="button" onClick={back}>Back</button>
      </div>
    </section>
  )
}
