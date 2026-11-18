import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadGraph } from './api.js'
import { readColors, rememberColor } from './storage.js'
import App from './App.jsx'

vi.mock('./components/GraphViewer.jsx', () => ({ default: () => <div>Graph viewer</div> }))
vi.mock('./api.js', () => ({ loadGraph: vi.fn(), saveGraph: vi.fn() }))

describe('App', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
  afterEach(cleanup)

  it('opens Config immediately when no graph is stored', () => {
    render(<App />)
    expect(screen.getByRole('dialog', { name: 'Config' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Graph navigation' })).not.toBeInTheDocument()
  })

  it('shows navigation for an existing graph', () => {
    localStorage.setItem('dotEditor:graph', 'digraph {}')
    render(<App />)
    expect(screen.getByRole('navigation', { name: 'Graph navigation' })).toBeInTheDocument()
  })

  it('opens Config and Edit panels via keyboard shortcuts', async () => {
    localStorage.setItem('dotEditor:graph', 'digraph {}')
    render(<App />)
    await userEvent.keyboard('e')
    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('c')
    expect(screen.getByRole('dialog', { name: 'Config' })).toBeInTheDocument()
  })

  it('creates and persists a graph on first visit', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'New graph' }))
    expect(localStorage.getItem('dotEditor:graph')).toMatch(/^digraph/)
    expect(screen.getByRole('navigation', { name: 'Graph navigation' })).toBeInTheDocument()
  })

  it('prefills color memory from an existing graph without moving saved colors', () => {
    rememberColor('#445566')
    localStorage.setItem('dotEditor:graph', 'digraph G { graph [color="#ffffff"]; a [color="#112233", fillcolor="#445566"]; subgraph cluster_x { graph [bgcolor="#778899"]; b; } a -> b [color="#aabbcc"]; }')
    render(<App />)
    expect(readColors()).toEqual(['#445566', '#112233', '#778899', '#aabbcc'])
  })

  it('prefills color memory after Raw DOT is applied', async () => {
    localStorage.setItem('dotEditor:graph', 'digraph G {}')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Raw DOT' }))
    fireEvent.change(screen.getByLabelText('DOT source'), { target: { value: 'digraph G { a [color="#123456", fillcolor="red"]; }' } })
    await userEvent.click(screen.getByRole('button', { name: 'Apply DOT' }))
    expect(readColors()).toEqual(['#123456'])
  })

  it('confirms deletion before persisting a node and its connected arrows', async () => {
    const dot = 'digraph G { a; a -> b; b -> c; }'
    localStorage.setItem('dotEditor:graph', dot)
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit node' }))
    await userEvent.click(screen.getByRole('button', { name: 'Del node a' }))
    expect(screen.getByText('Will delete 1 nodes, 1 arrows and 0 groups.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(localStorage.getItem('dotEditor:graph')).toBe(dot)
    await userEvent.click(screen.getByRole('button', { name: 'Del node a' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(localStorage.getItem('dotEditor:graph')).toContain('b -> c;')
    expect(localStorage.getItem('dotEditor:graph')).not.toContain('a -> b;')
    expect(screen.queryByRole('button', { name: 'Del node a' })).not.toBeInTheDocument()
  })

  it('prefills color memory after loading a remote graph', async () => {
    loadGraph.mockResolvedValue('digraph G { a -> b [color="#abcdef"]; }')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Load' }))
    await waitFor(() => expect(readColors()).toEqual(['#abcdef']))
  })
})
