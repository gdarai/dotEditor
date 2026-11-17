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
  const previous = JSON.parse(readSetting('colors') || '[]')
  const colors = [color, ...previous.filter(item => item !== color)].slice(0, 8)
  writeSetting('colors', JSON.stringify(colors))
  return colors
}

export function readColors() {
  const colors = JSON.parse(readSetting('colors') || '[]')
  if (!Array.isArray(colors) || !colors.every(color => typeof color === 'string')) {
    throw new Error('Stored color history is invalid')
  }
  return colors
}
