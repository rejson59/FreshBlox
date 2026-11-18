export function readLocal(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`freshblox.hub.${key}`) ?? 'null')
  } catch {
    return null
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(`freshblox.hub.${key}`, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
