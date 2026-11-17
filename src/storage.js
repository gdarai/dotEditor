export const keys = {
  graph: 'dotEditor:graph',
  graphName: 'dotEditor:graphName',
  layout: 'dotEditor:layout',
  apiUrl: 'dotEditor:apiUrl',
  colors: 'dotEditor:colors',
}

export function readSetting(key) {
  return localStorage.getItem(keys[key])
}

export function writeSetting(key, value) {
  if (value === null) localStorage.removeItem(keys[key])
  else localStorage.setItem(keys[key], value)
}

export function rememberColor(color) {
  const previous = readColors()
  if (previous.some(item => item.toLowerCase() === color.toLowerCase())) return previous
  const colors = [color, ...previous].slice(0, 8)
  writeSetting('colors', JSON.stringify(colors))
  return colors
}

export function appendColors(newColors) {
  const previous = readColors()
  const colors = [...previous]
  for (const color of newColors) {
    if (!colors.some(item => item.toLowerCase() === color.toLowerCase()) && colors.length < 8) colors.push(color)
  }
  if (colors.length !== previous.length) writeSetting('colors', JSON.stringify(colors))
  return colors
}

export function readColors() {
  const colors = JSON.parse(readSetting('colors') || '[]')
  if (!Array.isArray(colors) || !colors.every(color => typeof color === 'string')) {
    throw new Error('Stored color history is invalid')
  }
  return colors
}
