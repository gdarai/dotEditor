import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { planDeletion } from '../graph/dot.js'
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
  planDeletion: vi.fn(() => ({
    counts: { nodes: 2, arrows: 1, groups: 1 },
    deleted: 'digraph { deleted; }',
    kept: 'digraph { kept; }',
  })),
}))

describe('EditDialog', () => {
  const onCommit = vi.fn()
  beforeEach(() => render(<EditDialog dot="digraph { a; }" onCommit={onCommit} onClose={vi.fn()} />))
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('offers distinct create and edit actions', () => {
    expect(screen.getByRole('button', { name: '(+) Group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit arrow' })).toBeInTheDocument()
  })

  it('creates a node through the focused form', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Node' }))
    await userEvent.type(screen.getByLabelText('Node ID'), 'b')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { a; b; }')
  })

  it('places Apply and Back together in the footer for a new node', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Node' }))
    const actions = within(screen.getByRole('group', { name: 'Dialog actions' }))
    expect(actions.getAllByRole('button').map(button => button.textContent)).toEqual(['Apply', 'Back'])
    expect(actions.getByRole('button', { name: 'Apply' })).toHaveClass('button-apply')
    expect(actions.getByRole('button', { name: 'Back' })).toHaveClass('button-back')
  })

  it('submits the new-node form with Enter after moving Apply to the footer', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Node' }))
    await userEvent.type(screen.getByLabelText('Node ID'), 'b{Enter}')
    expect(onCommit).toHaveBeenCalledWith('digraph { a; b; }')
  })

  it('keeps Apply DOT beside Back in the footer', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Raw DOT' }))
    const actions = within(screen.getByRole('group', { name: 'Dialog actions' }))
    expect(actions.getAllByRole('button').map(button => button.textContent)).toEqual(['Apply DOT', 'Back'])
    expect(actions.getByRole('button', { name: 'Apply DOT' })).toHaveClass('button-apply')
  })

  it('lists existing nodes for selection', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit node' }))
    expect(screen.getByRole('button', { name: 'a' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Del node a' })).toHaveAttribute('title', 'Del')
    expect(screen.getByRole('button', { name: 'Del node a' })).toHaveClass('button-delete')
  })

  it('requires confirmation before deleting a node and defaults to Back', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit node' }))
    await userEvent.click(screen.getByRole('button', { name: 'Del node a' }))
    expect(screen.getByText('Will delete 2 nodes, 1 arrows and 1 groups.')).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
    const actions = within(screen.getByRole('group', { name: 'Dialog actions' }))
    const back = actions.getByRole('button', { name: 'Back' })
    expect(back).toHaveFocus()
    expect(back).not.toHaveClass('button-back')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Del node a' })).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Del node a' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(planDeletion).toHaveBeenCalledWith('digraph { a; }', 'node', { start: { offset: 1 } })
    expect(onCommit).toHaveBeenCalledWith('digraph { deleted; }')
  })

  it('offers keeping group children or deleting the whole group', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit group' }))
    await userEvent.click(screen.getByRole('button', { name: 'Del group cluster_team' }))
    expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Delete Elements' })).toHaveClass('button-delete')
    await userEvent.click(screen.getByRole('button', { name: 'Keep Elements' }))
    expect(onCommit).toHaveBeenLastCalledWith('digraph { kept; }')
    await userEvent.click(screen.getByRole('button', { name: 'Del group cluster_team' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Elements' }))
    expect(onCommit).toHaveBeenLastCalledWith('digraph { deleted; }')
  })

  it('allows deletion of complex arrows without opening the editing form', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Edit arrow' }))
    await userEvent.click(screen.getByRole('button', { name: 'Del arrow a → b' }))
    expect(screen.getByRole('heading', { name: 'Delete arrow?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { deleted; }')
  })

  it('shows deletion failures without committing or closing the confirmation', async () => {
    planDeletion.mockImplementationOnce(() => ({
      counts: { nodes: 1, arrows: 0, groups: 0 }, deleted: 'digraph {}',
    })).mockImplementationOnce(() => { throw new Error('Stale location') })
    await userEvent.click(screen.getByRole('button', { name: 'Edit node' }))
    await userEvent.click(screen.getByRole('button', { name: 'Del node a' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Stale location')
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('offers distinct graph IDs in both new-arrow endpoint inputs', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Arrow' }))
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
    await userEvent.click(screen.getByRole('button', { name: '(+) Arrow' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Source' }), 'b')
    await userEvent.type(screen.getByRole('combobox', { name: 'Target' }), 'new_id')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).toHaveBeenCalledWith('digraph { a; b; }')
  })

  it('does not submit an arrow without both endpoints', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Arrow' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Source' }), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('keeps the edit form open when Escape closes a color popup', async () => {
    await userEvent.click(screen.getByRole('button', { name: '(+) Node' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose Color' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Color color picker' })).not.toBeInTheDocument()
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
