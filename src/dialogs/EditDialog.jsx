import { useEffect, useRef, useState } from 'react'
import { createElement, inspectGraph, planDeletion, updateElement } from '../graph/dot.js'
import ColorPicker from '../components/ColorPicker.jsx'
import InputID from '../components/InputID.jsx'
import OptionsSelectBox from '../components/OptionsSelectBox.jsx'
import useEscapeKey from '../components/useEscapeKey.js'
import useAutoFocus from '../components/useAutoFocus.js'

const TYPES = { node: 'node', group: 'group', edge: 'arrow' }
const ACTIONS = [
  ['new-node', '(+) Node'], ['edit-node', 'Edit node'],
  ['new-edge', '(+) Arrow'], ['edit-edge', 'Edit arrow'],
  ['new-group', '(+) Group'], ['edit-group', 'Edit group'],
  ['raw', 'Raw DOT'],
]

function TextField({ label, value, onChange, required = false }) {
  return <label className="field">{label}<input required={required} value={value} onChange={event => onChange(event.target.value)} /></label>
}

function SelectField({ label, value, choices, onChange }) {
  const options = value && !choices.includes(value) ? [value, ...choices] : choices
  return <OptionsSelectBox label={label} value={value} options={options} onChange={onChange} />
}

export default function EditDialog({ dot, onCommit, onClose }) {
  const [page, setPage] = useState('home')
  const [action, setAction] = useState('')
  const [selected, setSelected] = useState(null)
  const [pendingDeletion, setPendingDeletion] = useState(null)
  const [fields, setFields] = useState({})
  const [raw, setRaw] = useState(dot)
  const [error, setError] = useState('')
  const graph = inspectGraph(dot)
  const ids = [...graph.nodes, ...graph.groups].map(item => item.id)
  const type = action.split('-')[1]
  const editing = action.startsWith('edit-')
  const dialogRef = useAutoFocus([page])
  const backRef = useRef(null)

  useEffect(() => {
    if (page === 'confirm') backRef.current?.focus()
  }, [page])

  function chooseAction(next) {
    setAction(next)
    setSelected(null)
    setPendingDeletion(null)
    setFields({ parentId: '', ...(next === 'new-group' && { id: 'cluster_' }) })
    setError('')
    if (next === 'raw') setRaw(dot)
    setPage(next === 'raw' ? 'raw' : next.startsWith('edit-') ? 'select' : 'form')
  }

  function chooseElement(element) {
    setSelected(element)
    setFields({
      ...(type === 'edge'
        ? { source: element.source, target: element.target }
        : { id: element.id }),
      ...element.attributes,
      parentId: element.parentId || '',
    })
    setError('')
    setPage('form')
  }

  function change(name, value) {
    setFields(current => ({ ...current, [name]: value }))
  }

  function back() {
    if (page === 'confirm') {
      setPendingDeletion(null)
      setPage('select')
    } else if (page === 'form' && editing) setPage('select')
    else setPage('home')
    setError('')
  }

  useEscapeKey(page === 'home' ? onClose : back)

  function commit(event) {
    event.preventDefault()
    try {
      const next = editing
        ? updateElement(dot, type, selected.location, fields)
        : createElement(dot, type, fields)
      onCommit(next)
      setError('')
      setPage('home')
    } catch (cause) {
      setError(cause.message)
    }
  }

  function commitRaw() {
    try {
      inspectGraph(raw)
      onCommit(raw)
      setError('')
      setPage('home')
    } catch (cause) {
      setError(cause.message)
    }
  }

  function requestDeletion(element) {
    try {
      const { counts } = planDeletion(dot, type, element.location)
      setPendingDeletion({ element, counts })
      setError('')
      setPage('confirm')
    } catch (cause) {
      setError(cause.message)
    }
  }

  function confirmDeletion(keepElements = false) {
    try {
      const plan = planDeletion(dot, type, pendingDeletion.element.location)
      onCommit(keepElements ? plan.kept : plan.deleted)
      setPendingDeletion(null)
      setError('')
      setPage('select')
    } catch (cause) {
      setError(cause.message)
    }
  }

  const entries = type === 'node' ? graph.nodes : type === 'group' ? graph.groups : graph.edges
  const heading = ACTIONS.find(([key]) => key === action)?.[1]
  const count = pendingDeletion?.counts

  return (
    <section className="dialog edit-dialog" role="dialog" aria-modal="true" aria-label="Edit" ref={dialogRef}>
      <h2>{page === 'home' ? 'Edit' : page === 'confirm' ? `Delete ${TYPES[type]}?` : heading}</h2>
      {page === 'home' && (
        <div className="action-grid">
          {ACTIONS.map(([key, label]) => <button key={key} type="button" onClick={() => chooseAction(key)}>{label}</button>)}
        </div>
      )}
      {page === 'select' && (
        <div className="selection-list" aria-label={`Select ${TYPES[type]}`}>
          {entries.length === 0 && <p>No {TYPES[type]}s to edit.</p>}
          {entries.map((item, index) => (
            <div className="selection-row" key={`${item.location.start.offset}-${index}`}>
              <button type="button" onClick={() => chooseElement(item)}>
                {type === 'edge' ? `${item.source} ${graph.directed ? '→' : '—'} ${item.target}` : item.id}
                {item.implicit ? ' (implicit)' : ''}
                {item.complex ? ' (raw DOT only)' : ''}
              </button>
              <button className="button-delete" type="button" title="Del" aria-label={`Del ${TYPES[type]} ${type === 'edge' ? `${item.source} ${graph.directed ? '→' : '—'} ${item.target}` : item.id}`} onClick={() => requestDeletion(item)}>Del</button>
            </div>
          ))}
        </div>
      )}
      {page === 'confirm' && <>
        <p>Will delete {count.nodes} nodes, {count.arrows} arrows and {count.groups} groups.</p>
        {type === 'group' && <p>Keep Elements removes the group but moves its contained elements into the parent graph.</p>}
      </>}
      {page === 'form' && selected?.complex && (
        <p>Complex edges cannot be edited safely here. Use the Raw DOT card instead.</p>
      )}
      {page === 'form' && !selected?.complex && (
        <form id="edit-element-form" onSubmit={commit}>
          <div className="fields">
            {type !== 'edge' && <TextField label={type === 'group' ? 'Cluster ID' : 'Node ID'} required value={fields.id || ''} onChange={value => change('id', value)} />}
            <InputID label="Parent group" value={fields.parentId || ''} options={graph.groups.map(group => group.id)} onChange={value => change('parentId', value)} />
            {type === 'edge' && <>
              <InputID label="Source" required value={fields.source || ''} options={ids} onChange={value => change('source', value)} />
              <InputID label="Target" required value={fields.target || ''} options={ids} onChange={value => change('target', value)} />
            </>}
            <TextField label="Label" value={fields.label || ''} onChange={value => change('label', value)} />
            {type === 'node' && <SelectField label="Shape" value={fields.shape || ''} choices={['box', 'ellipse', 'circle', 'diamond', 'plaintext']} onChange={value => change('shape', value)} />}
            <SelectField label="Style" value={fields.style || ''} choices={['solid', 'dashed', 'dotted', 'bold', 'filled', 'rounded']} onChange={value => change('style', value)} />
            <ColorPicker label="Color" value={fields.color || ''} onChange={value => change('color', value)} />
            {type === 'node' && <ColorPicker label="Fill color" value={fields.fillcolor || ''} onChange={value => change('fillcolor', value)} />}
            {type === 'group' && <ColorPicker label="Background color" value={fields.bgcolor || ''} onChange={value => change('bgcolor', value)} />}
            {type === 'edge' && graph.directed && <SelectField label="Arrowhead" value={fields.arrowhead || ''} choices={['normal', 'none', 'vee', 'dot', 'diamond']} onChange={value => change('arrowhead', value)} />}
          </div>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
      {page === 'raw' && <>
        <label className="field">DOT source<textarea value={raw} onChange={event => setRaw(event.target.value)} spellCheck="false" /></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="card-footer" role="group" aria-label="Dialog actions">
        {page === 'confirm' && <>
          <button ref={backRef} type="button" onClick={back}>Back</button>
          {type === 'group' && <button type="button" onClick={() => confirmDeletion(true)}>Keep Elements</button>}
          <button className="button-delete" type="button" onClick={() => confirmDeletion()}>{type === 'group' ? 'Delete Elements' : 'Delete'}</button>
        </>}
        {page === 'form' && !selected?.complex && <button className="button-apply" type="submit" form="edit-element-form">Apply</button>}
        {page === 'raw' && <button className="button-apply" type="button" onClick={commitRaw}>Apply DOT</button>}
        {page !== 'confirm' && <button className="button-back" type="button" onClick={page === 'home' ? onClose : back}>Back</button>}
      </div>
    </section>
  )
}
