import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfigDialog from './ConfigDialog.jsx'

vi.mock('../api.js', () => ({ saveGraph: vi.fn(), loadGraph: vi.fn() }))
vi.mock('../graph/dot.js', () => ({ inspectGraph: vi.fn() }))

describe('ConfigDialog', () => {
  const onCreate = vi.fn()
  const onChange = vi.fn()
  const onLoad = vi.fn()
  beforeEach(() => render(<ConfigDialog dot="" graphName="G" apiUrl="" apiKey="" layout="auto" onChange={onChange} onCreate={onCreate} onLoad={onLoad} onExport={vi.fn()} onClose={vi.fn()} />))
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('requires creating or loading a graph on first visit', () => {
    expect(screen.getByRole('button', { name: 'New graph' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('offers creation of an empty graph', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'New graph' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  it('reports layout preference changes', async () => {
    await userEvent.selectOptions(screen.getByLabelText('Display'), 'mobile')
    expect(onChange).toHaveBeenCalledWith('layout', 'mobile')
  })
})
