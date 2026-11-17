import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditDialog from './EditDialog.jsx'

vi.mock('../graph/dot.js', () => ({
  inspectGraph: () => ({
    directed: true,
    nodes: [{ id: 'a', location: { start: { offset: 1 } }, attributes: {} }],
    groups: [], edges: [],
  }),
  createElement: vi.fn(() => 'digraph { a; b; }'),
  updateElement: vi.fn(() => 'digraph { a [label="A"]; }'),
}))

describe('EditDialog', () => {
  const onCommit = vi.fn()
  beforeEach(() => render(<EditDialog dot="digraph { a; }" onCommit={onCommit} onClose={vi.fn()} />))
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('offers distinct create and edit actions', () => {
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit arrow' })).toBeInTheDocument()
  })

  it('creates a node through the focused form', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New node' }))
    await userEvent.type(screen.getByLabelText('Node ID'), 'b')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { a; b; }')
  })

  it('lists existing nodes for selection', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit node' }))
    expect(screen.getByRole('button', { name: 'a' })).toBeInTheDocument()
  })
})
