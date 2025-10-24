export function normalizePath(path: string): string {
  // remove leading and trailing slashes and spaces
  path = path.trim().replace(/^\/+|\/+$/g, '')

  return path
}

export function resolvePath(folder: string, name: string): string {
  folder = normalizePath(folder)
  name = normalizePath(name)

  if (folder === '') {
    return name
  }

  return `${folder}/${name}`
}
