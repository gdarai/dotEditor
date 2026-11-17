import { useEffect, useRef, useState } from 'react'
import { instance } from '@viz-js/viz'

let vizPromise

function getViz() {
  vizPromise ||= instance()
  return vizPromise
}

export default function GraphViewer({ dot, viewport, onDimensions }) {
  const stage = useRef(null)
  const image = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function renderGraph() {
      try {
        const viz = await getViz()
        const svg = viz.renderSVGElement(dot)
        if (!active) return
        image.current.replaceChildren(svg)
        const box = svg.getAttribute('viewBox')?.split(/\s+/).map(Number)
        onDimensions(current => ({
          ...current,
          graphWidth: box?.[2] || parseFloat(svg.getAttribute('width')) || 0,
          graphHeight: box?.[3] || parseFloat(svg.getAttribute('height')) || 0,
        }))
        setError('')
      } catch (cause) {
        if (active) setError(`Graph could not be rendered: ${cause.message}`)
      }
    }
    renderGraph()
    return () => { active = false }
  }, [dot, onDimensions])

  useEffect(() => {
    function measure() {
      if (!stage.current) return
      onDimensions(current => ({
        ...current,
        width: stage.current.clientWidth,
        height: stage.current.clientHeight,
      }))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [onDimensions])

  return (
    <main ref={stage} className="graph-stage" aria-label="Graph viewer">
      <div ref={image} className="graph-image" style={{
        transform: `translate(-50%, -50%) translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      }} />
      {error && <div role="alert" className="render-error">{error}</div>}
    </main>
  )
}
