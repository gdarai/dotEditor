import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditDialog from './EditDialog.jsx'

vi.mock('../graph/dot.js', () => ({
  inspectGraph: () => ({
    directed: true,
    nodes: [
      { id: 'a', location: { start: { offset: 1 } }, attributes: {} },
      { id: 'b', implicit: true, location: { start: { offset: 2 } }, attributes: {} },
      { id: 'cluster_team', location: { start: { offset: 3 } }, attributes: {} },
    ],
    groups: [
      { id: 'cluster_team', location: { start: { offset: 4 } }, attributes: {} },
    ],
    edges: [{ source: 'a', target: 'b', location: { start: { offset: 5 } }, attributes: {} }],
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

  it('offers distinct graph IDs in both new-arrow endpoint inputs', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New arrow' }))
    const source = screen.getByRole('combobox', { name: 'Source' })
    const target = screen.getByRole('combobox', { name: 'Target' })
    expect(source).toBeRequired()
    expect(target).toBeRequired()
    expect(source.getAttribute('list')).not.toBe(target.getAttribute('list'))
    for (const list of screen.getAllByRole('listbox', { hidden: true })) {
      expect([source.getAttribute('list'), target.getAttribute('list')]).toContain(list.id)
      expect(within(list).getAllByRole('option', { hidden: true }).map(option => option.value)).toEqual(['a', 'b', 'cluster_team'])
    }
  })

  it('allows a new arrow to use an existing ID and a typed ID', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New arrow' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Source' }), 'b')
    await userEvent.type(screen.getByRole('combobox', { name: 'Target' }), 'new_id')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { a; b; }')
  })

  it('does not submit an arrow without both endpoints', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New arrow' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Source' }), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps the selected endpoints editable in Edit arrow', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit arrow' }))
    await userEvent.click(screen.getByRole('button', { name: 'a → b' }))
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('a')
    expect(screen.getByRole('combobox', { name: 'Target' })).toHaveValue('b')
    expect(screen.getAllByRole('listbox', { hidden: true })).toHaveLength(2)
    await userEvent.clear(screen.getByRole('combobox', { name: 'Target' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Target' }), 'cluster_team')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { a [label="A"]; }')
  })
})
