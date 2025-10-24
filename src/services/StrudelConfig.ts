import { normalizePath } from '@/helpers/pathHelpers'

interface StrudelConfigData {
  cacheDir: string | null
  saveToCache: boolean
}

export class StrudelConfig {
  private static instance: StrudelConfig

  public cacheDir: string | null = null
  public saveToCache = true

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
  }

  public getCacheDir(): string | null {
    return this.cacheDir && normalizePath(this.cacheDir)
  }

  toDTO(): StrudelConfigData {
    return {
      cacheDir: this.cacheDir,
      saveToCache: this.saveToCache,
    }
  }
}
