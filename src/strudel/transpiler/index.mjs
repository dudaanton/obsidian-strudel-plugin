import { evaluate as _evaluate } from '../core/index.mjs'
import { transpiler } from './transpiler.mjs'
export * from './transpiler.mjs'

export const evaluate = (code) => _evaluate(code, transpiler)
