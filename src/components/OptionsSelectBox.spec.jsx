import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OptionsSelectBox from './OptionsSelectBox.jsx'

describe('OptionsSelectBox', () => {
  const onChange = vi.fn()
  beforeEach(() => render(<OptionsSelectBox label="Shape" value="" options={['box', 'ellipse']} onChange={onChange} />))
  afterEach(() => { cleanup(); onChange.mockClear() })

  it('offers an empty optional choice', () => {
    expect(screen.getByRole('combobox', { name: 'Shape' })).toHaveValue('')
  })

  it('reports the selected option', async () => {
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Shape' }), 'box')
    expect(onChange).toHaveBeenCalledWith('box')
  })
})
