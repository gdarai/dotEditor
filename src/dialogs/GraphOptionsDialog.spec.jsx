import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { inspectGraph, readGraphOptions } from '../graph/dot.js'
import GraphOptionsDialog from './GraphOptionsDialog.jsx'

const dot = 'digraph { graph [rankdir=LR, fontname="Custom Font", fontcolor=red, splines=ortho, compound=true, custom=kept]; subgraph cluster_x { graph [rank=same, fontcolor=blue]; a; } }'

describe('GraphOptionsDialog', () => {
  afterEach(cleanup)

  it('prefills root settings, offers font suggestions, and preserves custom values', async () => {
    const onCommit = vi.fn()
    render(<GraphOptionsDialog dot={dot} onCommit={onCommit} onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Top Config' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rank direction' })).toHaveValue('LR')
    expect(screen.getByRole('combobox', { name: 'Splines' })).toHaveValue('ortho')
    expect(screen.getByRole('combobox', { name: 'Compound' })).toHaveValue('true')
    expect(screen.getByRole('combobox', { name: 'Font name' })).toHaveValue('Custom Font')
    const fonts = screen.getByRole('combobox', { name: 'Font name' })
    expect(within(document.getElementById(fonts.getAttribute('list'))).getAllByRole('option', { hidden: true }).length).toBeLessThanOrEqual(10)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rank direction' }), 'BT')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Splines' }), '')
    await userEvent.clear(screen.getByRole('textbox', { name: 'Font color value' }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    const changed = onCommit.mock.calls[0][0]
    expect(readGraphOptions(changed)).toEqual({ rankdir: 'BT', fontname: 'Custom Font', compound: 'true' })
    expect(changed).toContain('custom=kept')
    expect(readGraphOptions(changed, inspectGraph(changed).groups[0].location)).toEqual({ rank: 'same', fontcolor: 'blue' })
  })

  it('shows only cluster options and discards edits on Back', async () => {
    const onCommit = vi.fn()
    const onBack = vi.fn()
    render(<GraphOptionsDialog dot={dot} group={inspectGraph(dot).groups[0]} onCommit={onCommit} onBack={onBack} />)
    expect(screen.getByRole('combobox', { name: 'Rank' })).toHaveValue('same')
    expect(screen.queryByRole('combobox', { name: 'Splines' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Compound' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rank' }), 'sink')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onCommit).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('commits cluster attributes while preserving root and other cluster settings', async () => {
    const onCommit = vi.fn()
    const onBack = vi.fn()
    render(<GraphOptionsDialog dot={dot} group={inspectGraph(dot).groups[0]} onCommit={onCommit} onBack={onBack} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rank' }), '')
    await userEvent.type(screen.getByRole('combobox', { name: 'Font name' }), 'Arial')
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(readGraphOptions(onCommit.mock.calls[0][0], inspectGraph(onCommit.mock.calls[0][0]).groups[0].location)).toEqual({ fontcolor: 'blue', fontname: 'Arial' })
    expect(readGraphOptions(onCommit.mock.calls[0][0]).compound).toBe('true')
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog open on failed commits', async () => {
    const onCommit = vi.fn(() => { throw new Error('Storage unavailable') })
    const onBack = vi.fn()
    render(<GraphOptionsDialog dot={dot} onCommit={onCommit} onBack={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(onBack).not.toHaveBeenCalled()
  })
})
