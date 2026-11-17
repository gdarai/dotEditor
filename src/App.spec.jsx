import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'

vi.mock('./components/GraphViewer.jsx', () => ({ default: () => <div>Graph viewer</div> }))
vi.mock('./graph/dot.js', () => ({ inspectGraph: vi.fn() }))

describe('App', () => {
  beforeEach(() => localStorage.clear())
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

  it('creates and persists a graph on first visit', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'New graph' }))
    expect(localStorage.getItem('dotEditor:graph')).toMatch(/^digraph/)
    expect(screen.getByRole('navigation', { name: 'Graph navigation' })).toBeInTheDocument()
  })
})
