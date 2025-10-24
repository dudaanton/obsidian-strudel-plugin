import { normalizePath } from '@/helpers/pathHelpers'

interface StrudelConfigData {
  cacheDir: string | null
  saveToCache: boolean
  samplesToPreload: string[]
}

export class StrudelConfig {
  private static instance: StrudelConfig

  public cacheDir: string | null = null
  public saveToCache = true
  public samplesToPreload: string[] = [
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/tidal-drum-machines.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/piano.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/Dirt-Samples.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/EmuSP12.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/vcsl.json',
    'https://raw.githubusercontent.com/felixroos/dough-samples/main/mridangam.json',
  ]

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): StrudelConfig {
    if (!StrudelConfig.instance) {
      StrudelConfig.instance = new StrudelConfig()
    }
    return StrudelConfig.instance
  }

  public applySettings(data: StrudelConfigData): void {
    this.cacheDir = data.cacheDir || null
    if (data.saveToCache !== undefined) {
      this.saveToCache = data.saveToCache
    }
    this.samplesToPreload = data.samplesToPreload ? [...data.samplesToPreload] : []
  }

  public getCacheDir(): string | null {
    return this.cacheDir && normalizePath(this.cacheDir)
  }

  toDTO(): StrudelConfigData {
    return {
      cacheDir: this.cacheDir,
      saveToCache: this.saveToCache,
      samplesToPreload: this.samplesToPreload,
    }
  }
}
