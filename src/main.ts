import { MarkdownPostProcessorContext, Plugin } from 'obsidian'
import './styles.css'
import { GlobalStore } from './stores/GlobalStore'
import { createApp, App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import VueEntry from './App.vue'
import { StrudelConfig } from './services/StrudelConfig'
import { strudelStateField } from './editor/StrudelPlugin'
import { highlightExtension } from './editor/StrudelHighlight'
// import { STRUDEL_CODEBLOCK_KEYWORD } from './constants/keywords'
// import { StrudelRenderer } from './editor/StrudelRenderer'
// import { highlightExtension } from '@/strudel/codemirror/highlight.mjs'

import './editor/SyntaxHighlighting.js'
import { createStrudelBlock } from './commands/createStrudelBlock'

export interface StrudelSettings {}

const DEFAULT_SETTINGS: StrudelSettings = {}

interface PluginData {}

export default class StrudelPlugin extends Plugin {
  settings: StrudelSettings
  strudelConfig: StrudelConfig
  private data: PluginData = {}

  private vueApp: VueApp | null = null

  initializeVue() {
    const rootContainer = document.createElement('div')
    rootContainer.id = 'strudel-vue-root'
    rootContainer.style.display = 'none'
    document.body.appendChild(rootContainer)

    this.vueApp = createApp(VueEntry)
    this.vueApp.use(createPinia())
    this.vueApp.mount(rootContainer)
  }

  getVueApp(): VueApp {
    return this.vueApp!
  }

  async onload() {
    await this.loadPluginData()
    await this.loadSettings()

    GlobalStore.getInstance().init(this.app)

    // this.addSettingTab(new StrudelSettingTab(this.app, this))

    console.log('Strudel REPL Plugin loaded.')

    this.initializeVue()

    this.registerEditorExtension(strudelStateField)
    this.registerEditorExtension(highlightExtension)

    GlobalStore.getInstance().initStrudel()

    // this.addCommand({
    //   id: 'create-strudel-block',
    //   name: 'Create new strudel block',
    //   callback: () => {
    //     createStrudelBlock()
    //   },
    // })
  }

  onunload() {
    GlobalStore.getInstance().destroy()
    if (this.vueApp) {
      this.vueApp.unmount()
      document.getElementById('strudel-vue-root')?.remove()
    }
    console.log('Strudel REPL plugin unloaded.')
  }

  applySettings() {
    this.strudelConfig = StrudelConfig.getInstance()
    // this.strudelConfig.refreshDelay = this.settings.refreshDelay
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    this.applySettings()
  }

  async saveSettings() {
    await this.saveData(this.settings)
    this.applySettings()
  }

  async loadPluginData() {
    this.data = (await this.loadData()) || {}
  }

  async savePluginData() {
    await this.saveData(this.data)
  }
}

// class StrudelSettingTab extends PluginSettingTab {
//   plugin: StrudelPlugin
//
//   constructor(app: App, plugin: StrudelPlugin) {
//     super(app, plugin)
//     this.plugin = plugin
//   }
//
//   display(): void {
//     const { containerEl } = this
//
//     containerEl.empty()
//
//     containerEl.createEl('h2', { text: 'Strudel REPL Settings' })
//   }
// }
