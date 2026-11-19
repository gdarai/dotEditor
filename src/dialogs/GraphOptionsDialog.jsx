import { useState } from 'react'
import { readGraphOptions, updateGraphOptions } from '../graph/dot.js'
import ColorPicker from '../components/ColorPicker.jsx'
import InputID from '../components/InputID.jsx'
import OptionsSelectBox from '../components/OptionsSelectBox.jsx'
import useAutoFocus from '../components/useAutoFocus.js'
import useEscapeKey from '../components/useEscapeKey.js'

const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Tahoma', 'Trebuchet MS', 'DejaVu Sans', 'DejaVu Serif']

function Choice({ label, value, options, onChange }) {
  return <OptionsSelectBox label={label} value={value}
    options={value && !options.includes(value) ? [value, ...options] : options}
    onChange={onChange} />
}

export default function GraphOptionsDialog({ dot, group = null, onCommit, onBack }) {
  const [fields, setFields] = useState(() => readGraphOptions(dot, group?.location))
  const [error, setError] = useState('')
  const dialogRef = useAutoFocus()
  useEscapeKey(onBack)

  function change(key, value) {
    setFields(current => ({ ...current, [key]: value }))
  }

  function apply(event) {
    event.preventDefault()
    try {
      onCommit(updateGraphOptions(dot, group?.location ?? null, {
        rankdir: fields.rankdir || '',
        rank: fields.rank || '',
        fontname: fields.fontname || '',
        fontcolor: fields.fontcolor || '',
        ...(!group && { splines: fields.splines || '', compound: fields.compound || '' }),
      }))
      setError('')
      onBack()
    } catch (cause) {
      setError(cause.message)
    }
  }

  return (
    <section className="dialog edit-dialog" role="dialog" aria-modal="true" aria-label="Graph Options" ref={dialogRef}>
      <h2>{group ? `Graph Options: ${group.id}` : 'Top Config'}</h2>
      <form id="graph-options-form" onSubmit={apply}>
        <div className="fields">
          <Choice label="Rank direction" value={fields.rankdir || ''} options={['TB', 'LR', 'BT', 'RL']} onChange={value => change('rankdir', value)} />
          <Choice label="Rank" value={fields.rank || ''} options={['same', 'min', 'max', 'source', 'sink']} onChange={value => change('rank', value)} />
          <InputID label="Font name" value={fields.fontname || ''} options={FONTS} onChange={value => change('fontname', value)} />
          <ColorPicker label="Font color" value={fields.fontcolor || ''} onChange={value => change('fontcolor', value)} />
          {!group && <>
            <Choice label="Splines" value={fields.splines || ''} options={['true', 'false', 'line', 'polyline', 'ortho', 'curved', 'spline']} onChange={value => change('splines', value)} />
            <Choice label="Compound" value={fields.compound || ''} options={['true', 'false']} onChange={value => change('compound', value)} />
          </>}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      <div className="card-footer" role="group" aria-label="Dialog actions">
        <button className="button-apply" type="submit" form="graph-options-form">Apply</button>
        <button className="button-back" type="button" onClick={onBack}>Back</button>
      </div>
    </section>
  )
}
