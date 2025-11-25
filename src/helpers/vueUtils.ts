import { nanoid } from 'nanoid'

export function genid(): string {
  return `vue-${nanoid()}`
}
