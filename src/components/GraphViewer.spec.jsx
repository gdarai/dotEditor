import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import GraphViewer from './GraphViewer.jsx'

const renderSVGElement = vi.fn()
vi.mock('@viz-js/viz', () => ({ instance: async () => ({ renderSVGElement }) }))

describe('GraphViewer', () => {
  const onDimensions = vi.fn()
  beforeEach(() => {
    renderSVGElement.mockReset()
    onDimensions.mockClear()
  })
  afterEach(cleanup)

  it('renders a graph into the viewer', async () => {
    renderSVGElement.mockImplementation(() => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('viewBox', '0 0 120 80')
      return svg
    })
    render(<GraphViewer dot="digraph {}" viewport={{ x: 0, y: 0, zoom: 1 }} onDimensions={onDimensions} />)
    await waitFor(() => expect(screen.getByLabelText('Graph viewer').querySelector('svg')).toBeInTheDocument())
    expect(renderSVGElement).toHaveBeenCalledWith('digraph {}')
  })

  it('reports rendering errors rather than replacing the graph', async () => {
    renderSVGElement.mockImplementation(() => { throw new Error('bad DOT') })
    render(<GraphViewer dot="invalid" viewport={{ x: 0, y: 0, zoom: 1 }} onDimensions={onDimensions} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('bad DOT')
  })
})
