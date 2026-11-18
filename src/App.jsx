import { useState } from 'react'
import GraphViewer from './components/GraphViewer.jsx'
import ConfigDialog from './dialogs/ConfigDialog.jsx'
import EditDialog from './dialogs/EditDialog.jsx'
import ExportPage from './dialogs/ExportPage.jsx'
import NavigationDialog from './dialogs/NavigationDialog.jsx'
import { clampPan, moveViewport } from './dialogs/NavigationDialog.utils.js'
import { inspectGraph } from './graph/dot.js'
import { appendColors, readSetting, writeSetting } from './storage.js'
import useShortcuts from './components/useShortcuts.js'

function rememberGraphColors(graph) {
  const colors = [...graph.nodes, ...graph.groups, ...graph.edges]
    .flatMap(item => ['color', 'fillcolor', 'bgcolor'].map(key => item.attributes[key]))
    .filter(color => /^#[0-9a-f]{6}$/i.test(color))
  appendColors(colors)
}

function initialState() {
  try {
    const graph = readSetting('graph') || ''
    const parsed = graph && inspectGraph(graph)
    let error = ''
    if (parsed) {
      try {
        rememberGraphColors(parsed)
      } catch (cause) {
        error = `Could not update color memory: ${cause.message}`
      }
    }
    return {
      dot: graph,
      graphName: readSetting('graphName') || '',
      apiUrl: readSetting('apiUrl') || '',
      layout: readSetting('layout') || 'auto',
      error,
    }
  } catch (cause) {
    return { dot: '', graphName: '', apiUrl: '', layout: 'auto', error: `Stored graph or settings could not be read: ${cause.message}` }
  }
}

export default function App() {
  const [initial] = useState(initialState)
  const [dot, setDot] = useState(initial.dot)
  const [graphName, setGraphName] = useState(initial.graphName)
  const [apiUrl, setApiUrl] = useState(initial.apiUrl)
  const [apiKey, setApiKey] = useState('')
  const [layout, setLayout] = useState(initial.layout)
  const [error, setError] = useState(initial.error)
  const [panel, setPanel] = useState(initial.dot ? '' : 'config')
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, graphWidth: 0, graphHeight: 0 })

  function commit(next) {
    writeSetting('graph', next)
    setDot(next)
    setViewport({ x: 0, y: 0, zoom: 1 })
    try {
      rememberGraphColors(inspectGraph(next))
      setError('')
    } catch (cause) {
      setError(`Could not update color memory: ${cause.message}`)
    }
  }

  function changeConfig(name, value) {
    try {
      if (name === 'apiKey') setApiKey(value)
      else {
        writeSetting(name, value)
        if (name === 'graphName') setGraphName(value)
        if (name === 'apiUrl') setApiUrl(value)
        if (name === 'layout') setLayout(value)
      }
      setError('')
    } catch (cause) {
      setError(`Could not save setting: ${cause.message}`)
    }
  }

  function create() {
    try {
      commit('digraph G {\n}\n')
      setPanel('')
    } catch (cause) {
      setError(`Could not create graph: ${cause.message}`)
    }
  }

  function onCommit(next) {
    try {
      commit(next)
    } catch (cause) {
      setError(`Could not store graph: ${cause.message}`)
      throw cause
    }
  }

  function zoom(factor) {
    setViewport(current => {
      const next = Math.max(0.2, Math.min(5, current.zoom * factor))
      return {
        x: clampPan(current.x, dimensions.graphWidth, dimensions.width, next),
        y: clampPan(current.y, dimensions.graphHeight, dimensions.height, next),
        zoom: next,
      }
    })
  }

  useShortcuts([
    { key: 'c', handler: () => setPanel('config') },
    { key: 'e', handler: () => { if (dot) setPanel('edit') } },
  ], !panel)

  if (panel === 'export') return <ExportPage dot={dot} onBack={() => setPanel('config')} />

  return (
    <div className={`app layout-${layout}`}>
      <GraphViewer dot={dot || 'digraph {}'} viewport={viewport} onDimensions={setDimensions} />
      <header className="toolbar">
        <button type="button" title="Shortcut: C" onClick={() => setPanel('config')}>Config</button>
        <button type="button" title="Shortcut: E" disabled={!dot} onClick={() => setPanel('edit')}>Edit</button>
      </header>
      {error && <div role="alert" className="app-error">{error}</div>}
      {panel === 'config' && <ConfigDialog
        dot={dot} graphName={graphName} apiUrl={apiUrl} apiKey={apiKey} layout={layout}
        onChange={changeConfig} onCreate={create}
        onLoad={loaded => { commit(loaded); setPanel('') }}
        onExport={() => setPanel('export')} onClose={() => setPanel('')}
      />}
      {panel === 'edit' && <EditDialog dot={dot} onCommit={onCommit} onClose={() => setPanel('')} />}
      {!panel && <NavigationDialog onMove={direction => setViewport(current => moveViewport(current, dimensions, direction))} onZoom={zoom} />}
    </div>
  )
}
