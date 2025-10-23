import * as core from './core/index.mjs'
import * as mini from './mini/index.mjs'
import * as tonal from './tonal/index.mjs'
import * as webaudio from './webaudio/index.mjs'
import * as transpiler from './transpiler/index.mjs'
import * as draw from './draw/index.mjs'
import * as midi from './midi/index.mjs'
import * as soundfonts from './soundfonts/index.mjs'
import * as superdough from './superdough/index.mjs'
import * as supradough from './supradough/index.mjs'
import * as xen from './xen/index.mjs'

import { Pattern } from './core/pattern.mjs'
// import { evalScope, setTime } from './core/clockworker.js'
import { initAudioOnFirstClick, webaudioRepl } from './webaudio/index.mjs'
// import { registerSoundfonts } from './soundfonts/index.mjs';
import { evaluate as _evaluate } from './transpiler/index.mjs'
import { miniAllStrings } from './mini/index.mjs'

export async function initStrudel(options = {}) {
  initAudioOnFirstClick()
  options.miniAllStrings !== false && miniAllStrings()
  const repl = webaudioRepl({ ...options, transpiler: transpiler.transpiler })

  await superdough.samples('github:tidalcycles/dirt-samples')

  superdough.registerSynthSounds()
  soundfonts.registerSoundfonts()

  core.evalScope(core, mini, tonal, webaudio)

  setTimeout(() => repl.scheduler.now())

  // Pattern.prototype.play = function () {
  //   repl.setPattern(this, true)
  //   return this
  // }

  return repl
}

export function recalculateMiniLocations(code) {
  const { miniLocations } = transpiler.transpiler(code)
  return miniLocations
}
