import { afterEach, describe, expect, it, vi } from 'vitest'
import { endpointUrl, loadGraph, saveGraph } from './api.js'

describe('remote graph API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps existing query parameters while encoding credentials', () => {
    const url = new URL(endpointUrl('https://example.test/api/?tenant=one', 'save', 'a & b', 'k?#'))
    expect(url.pathname).toBe('/api/save')
    expect(url.searchParams.get('tenant')).toBe('one')
    expect(url.searchParams.get('key')).toBe('a & b')
    expect(url.searchParams.get('apiKey')).toBe('k?#')
  })

  it('posts raw DOT text and reports HTTP errors', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    vi.stubGlobal('fetch', fetch)
    await expect(saveGraph({
      url: 'https://example.test', graphName: 'G', apiKey: 'secret', dot: 'graph {}',
    })).rejects.toThrow('HTTP 403')
    expect(fetch.mock.calls[0][1].body).toBe('graph {}')
  })

  it('loads plain DOT and reports failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => 'digraph {}' }))
    await expect(loadGraph({ url: 'https://example.test', graphName: 'G', apiKey: '' }))
      .resolves.toBe('digraph {}')
  })
})
