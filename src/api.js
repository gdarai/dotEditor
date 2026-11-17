import endpoints from './config.json'

export function endpointUrl(base, endpoint, graphName, apiKey) {
  if (!base.trim() || !graphName.trim()) throw new Error('API URL and graph name are required')
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('API URL must use HTTP or HTTPS')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`
  url.searchParams.set('key', graphName)
  url.searchParams.set('apiKey', apiKey)
  return url.toString()
}

export async function saveGraph({ url, graphName, apiKey, dot }) {
  const response = await fetch(endpointUrl(url, endpoints.saveApi, graphName, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: dot,
  })
  if (!response.ok) throw new Error(`Save failed (HTTP ${response.status})`)
}

export async function loadGraph({ url, graphName, apiKey }) {
  const response = await fetch(endpointUrl(url, endpoints.loadApi, graphName, apiKey))
  if (!response.ok) throw new Error(`Load failed (HTTP ${response.status})`)
  return response.text()
}
