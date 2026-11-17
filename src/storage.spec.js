import { beforeEach, describe, expect, it } from 'vitest'
import { appendColors, keys, readColors, readSetting, rememberColor, writeSetting } from './storage.js'

describe('prefixed storage', () => {
  beforeEach(() => localStorage.clear())

  it('stores the graph in its own namespace', () => {
    writeSetting('graph', 'digraph {}')
    expect(localStorage.getItem(keys.graph)).toBe('digraph {}')
    expect(readSetting('graph')).toBe('digraph {}')
  })

  it('keeps eight recent unique colors without moving existing colors', () => {
    for (let i = 0; i < 10; i++) rememberColor(`#00000${i}`)
    const stored = readSetting('colors')
    rememberColor('#000005')
    expect(readColors()).toHaveLength(8)
    expect(readSetting('colors')).toBe(stored)
    expect(readColors()[0]).toBe('#000009')
  })

  it('appends new graph colors without moving saved colors or exceeding capacity', () => {
    rememberColor('#AABBCC')
    appendColors(['#aabbcc', '#112233', '#445566', '#112233'])
    expect(readColors()).toEqual(['#AABBCC', '#112233', '#445566'])
    appendColors(Array.from({ length: 10 }, (_, index) => `#00000${index}`))
    expect(readColors()).toEqual(['#AABBCC', '#112233', '#445566', '#000000', '#000001', '#000002', '#000003', '#000004'])
  })

  it('does not rewrite memory when all graph colors are already present', () => {
    writeSetting('colors', '["#ABCDEF"]')
    appendColors(['#abcdef'])
    expect(readSetting('colors')).toBe('["#ABCDEF"]')
  })
})
