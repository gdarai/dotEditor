import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { inspectGraph } from '../graph/dot.js'
import RearrangeGroupDialog from './RearrangeGroupDialog.jsx'

const dot = 'digraph { subgraph cluster_parent { subgraph cluster_team { a; subgraph cluster_child { b; } } } c; c -> a -> b; }'

describe('RearrangeGroupDialog', () => {
  afterEach(cleanup)

  it('filters individual declarations, changes only visible rows, and commits only on clicked Submit', async () => {
    const onCommit = vi.fn()
    render(<RearrangeGroupDialog dot={dot} onCommit={onCommit} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'cluster_team' }))
    const list = within(screen.getByLabelText('Rearrange elements'))
    expect(list.queryByRole('button', { name: /Group cluster_parent/ })).not.toBeInTheDocument()
    expect(list.queryByRole('button', { name: /Group cluster_team/ })).not.toBeInTheDocument()
    expect(list.getByRole('button', { name: /Node a/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter' }), 'Node c{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(list.getByRole('button', { name: /Node c/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard('{Enter}')
    expect(list.getByRole('button', { name: /Node c/ })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(list.getByRole('button', { name: /Node c/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(inspectGraph(onCommit.mock.calls[0][0]).nodes.find(node => node.id === 'c').parentId).toBe('cluster_team')
  })

  it('discards pending changes on Escape and returns to Edit on a second Escape', async () => {
    const onCommit = vi.fn()
    const onBack = vi.fn()
    render(<RearrangeGroupDialog dot={dot} onCommit={onCommit} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'cluster_team' }))
    await userEvent.click(screen.getByRole('button', { name: /Node a/ }))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: 'Rearrange Group' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'cluster_team' }))
    expect(screen.getByRole('button', { name: /Node a/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.keyboard('{Escape}')
    await userEvent.keyboard('{Escape}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('keeps duplicate-group errors visible and never commits ambiguous changes', async () => {
    const onCommit = vi.fn()
    render(<RearrangeGroupDialog dot="digraph { subgraph cluster_x {} subgraph cluster_x {} }" onCommit={onCommit} onBack={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'cluster_x' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/unique/)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not submit with Enter or Space while Submit is focused', async () => {
    const onCommit = vi.fn()
    render(<RearrangeGroupDialog dot={dot} onCommit={onCommit} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'cluster_team' }))
    screen.getByRole('button', { name: 'Submit' }).focus()
    await userEvent.keyboard('{Enter} ')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('shows the current group name for elements nested in another group instead of a generic message', async () => {
    render(<RearrangeGroupDialog dot={dot} onCommit={vi.fn()} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'cluster_team' }))
    const list = within(screen.getByLabelText('Rearrange elements'))
    expect(list.getByRole('button', { name: /Node b/ })).toHaveTextContent('In cluster_child')
    expect(list.getByRole('button', { name: /Node c/ })).toHaveTextContent('Not in the group')
  })

  it('lists duplicate node declarations separately and filters complex arrows by DOT text', async () => {
    render(<RearrangeGroupDialog dot="digraph { a; a; subgraph cluster_x {} {a b} -> c; }" onCommit={vi.fn()} onBack={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'cluster_x' }))
    expect(screen.getAllByRole('button', { name: /Node a/ })).toHaveLength(2)
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter' }), 'a b')
    expect(screen.getByRole('button', { name: /Arrow.*a b.*complex/ })).toBeInTheDocument()
  })
})
