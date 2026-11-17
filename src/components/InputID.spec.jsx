import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InputID from './InputID.jsx'

describe('InputID', () => {
  const onChange = vi.fn()

  function ControlledInput() {
    const [value, setValue] = useState('')
    return <InputID label="Source" value={value} options={['a', 'b', 'a', 'cluster_team']} onChange={next => { setValue(next); onChange(next) }} required />
  }

  beforeEach(() => render(<ControlledInput />))
  afterEach(() => { cleanup(); onChange.mockClear() })

  it('offers each ID only once', () => {
    expect(screen.getAllByRole('option', { hidden: true }).map(option => option.value)).toEqual(['a', 'b', 'cluster_team'])
  })

  it('allows typing an ID not in the suggestions', async () => {
    await userEvent.type(screen.getByRole('combobox', { name: 'Source' }), 'new node')
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('new node')
    expect(onChange).toHaveBeenLastCalledWith('new node')
  })

  it('accepts a suggested ID', () => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), { target: { value: 'b' } })
    expect(screen.getByRole('combobox', { name: 'Source' })).toHaveValue('b')
  })

  it('keeps the ID required', () => {
    expect(screen.getByRole('combobox', { name: 'Source' })).toBeRequired()
  })

  it('associates the text input with its suggestions', () => {
    const input = screen.getByRole('combobox', { name: 'Source' })
    expect(within(screen.getByRole('listbox', { hidden: true })).getAllByRole('option', { hidden: true })[0]).toHaveValue('a')
    expect(input).toHaveAttribute('list', screen.getByRole('listbox', { hidden: true }).id)
  })
})
