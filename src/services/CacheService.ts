import { GlobalStore } from '@/stores/GlobalStore'
import { StrudelConfig } from './StrudelConfig'
import { resolvePath } from '@/helpers/pathHelpers'

export class CacheService {
  async ensureFolderExists(path: string): Promise<void> {
    const { app } = GlobalStore.getInstance()

    try {
      const folderExists = await app.vault.adapter.exists(path)

      if (!folderExists) {
        await app.vault.adapter.mkdir(path)
      }
    } catch (error) {
      console.error(`Error ensuring folder exists at ${path}:`, error)
    }
  }

  async loadCacheFile(fileName: string, isBinary: boolean): Promise<any> {
    const cacheDir = StrudelConfig.getInstance().getCacheDir()
    const { app } = GlobalStore.getInstance()

    if (!cacheDir) return

    const filePath = resolvePath(cacheDir, fileName)

    try {
      await this.ensureFolderExists(cacheDir)
      if (isBinary) {
        const data = await app.vault.adapter.readBinary(filePath)
        return data
      } else {
        const content = await app.vault.adapter.read(filePath)
        const data = JSON.parse(content)
        return data
      }
    } catch (error) {
      // ignore error
    }
  }

  async saveCacheFile(fileName: string, data: any, isBinary: boolean): Promise<void> {
    const config = StrudelConfig.getInstance()
    const cacheDir = config.getCacheDir()
    const saveToCache = config.saveToCache
    const { app } = GlobalStore.getInstance()

    if (!cacheDir || !saveToCache) return

    const filePath = resolvePath(cacheDir, fileName)

    try {
      if (isBinary) {
        await app.vault.adapter.writeBinary(filePath, data)
      } else {
        await app.vault.adapter.write(filePath, JSON.stringify(data))
      }
    } catch (error) {
      console.error('Error caching file:', error)
    }
    return data
  }

  escapeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9_\-\.]/gi, '_')
  }
}
