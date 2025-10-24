import { UserConfig, defineConfig } from 'vite'
import path from 'path'
import builtins from 'builtin-modules'
import vue from '@vitejs/plugin-vue'
import replace from '@rollup/plugin-replace'

import { createLogger, build } from 'vite'

const end = '?audioworklet'

function bundleAudioWorkletPlugin() /* : PluginOption */ {
  let viteConfig /* : UserConfig */

  return {
    name: 'vite-plugin-bundle-audioworklet',
    /* apply: 'build', */
    enforce: 'post',

    config(config) {
      viteConfig = config
    },

    async transform(_code, id) {
      if (!id.endsWith(end)) {
        return
      }
      const entry = id.replace(end, '')
      const quietLogger = createLogger()
      quietLogger.info = () => undefined

      const output = await build({
        configFile: false,
        clearScreen: false,
        customLogger: quietLogger,
        build: {
          lib: {
            entry,
            name: '_',
            formats: ['iife'],
          },
          write: false,
        },
      })
      if (!(output instanceof Array)) {
        throw new Error('Expected output to be Array')
      }
      const iife = output[0].output[0].code
      const encoded = Buffer.from(iife, 'utf8').toString('base64')
      return `export default "data:text/javascript;base64,${encoded}";`
    },
  }
}

export default defineConfig(async ({ mode }) => {
  const { resolve } = path
  const prod = mode === 'production'

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [vue(), bundleAudioWorkletPlugin()],
    minify: prod,
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main.ts'),
        name: 'main',
        fileName: () => 'main.js',
        formats: ['cjs'],
      },
      sourcemap: prod ? false : 'inline',
      cssCodeSplit: false,
      emptyOutDir: true,
      outDir: 'build',
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'styles.css'
            }
            return '[name].[ext]'
          },
        },
        input: {
          main: resolve(__dirname, 'src/main.ts'),
        },
        plugins: [
          replace({
            'process.env.NODE_ENV': JSON.stringify(prod ? 'production' : 'development'),
          }),
        ],
        external: [
          'obsidian',
          'electron',
          '@codemirror/autocomplete',
          '@codemirror/collab',
          '@codemirror/commands',
          '@codemirror/language',
          '@codemirror/lint',
          '@codemirror/search',
          '@codemirror/state',
          '@codemirror/view',
          '@lezer/common',
          '@lezer/highlight',
          '@lezer/lr',
          ...builtins,
        ],
      },
    },
  } as UserConfig
})
