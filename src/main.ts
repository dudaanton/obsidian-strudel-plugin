import { App, Plugin, PluginSettingTab, Setting } from 'obsidian'
import './styles.css'
import { GlobalStore } from './stores/GlobalStore'
import { createApp, App as VueApp } from 'vue'
import { createPinia } from 'pinia'
import VueEntry from './App.vue'
import { StrudelConfig } from './services/StrudelConfig'
import { strudelStateField } from './editor/StrudelPlugin'
import { highlightExtension } from './editor/StrudelHighlight'

import './editor/SyntaxHighlighting.js'
import { createStrudelBlock } from './commands/createStrudelBlock'

export interface StrudelSettings {}

interface PluginData {}

export default class StrudelPlugin extends Plugin {
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
    await this.loadSettings()

    GlobalStore.getInstance().init(this.app)

    this.addSettingTab(new StrudelSettingTab(this.app, this))

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

  async loadSettings() {
    const data = await this.loadData()
    StrudelConfig.getInstance().applySettings(data)
  }

  async saveSettings() {
    await this.saveData(StrudelConfig.getInstance().toDTO())
  }
}

class StrudelSettingTab extends PluginSettingTab {
  plugin: StrudelPlugin

  constructor(app: App, plugin: StrudelPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Strudel REPL Settings' })

    new Setting(containerEl)
      .setName('Sounds cache directory')
      .setDesc('Directory where Strudel will store cached sounds.')
      .addText((text) =>
        text
          .setPlaceholder('Enter directory path')
          .setValue(StrudelConfig.getInstance().cacheDir)
          .onChange(async (value) => {
            StrudelConfig.getInstance().cacheDir = value
            await this.plugin.saveSettings()
          })
      )

    new Setting(containerEl)
      .setName('Save to cache')
      .setDesc(
        'Enable or disable saving generated sounds to the cache. If disabled, the cache folder will still be used to load existing sounds.'
      )
      .addToggle((toggle) =>
        toggle.setValue(StrudelConfig.getInstance().saveToCache).onChange(async (value) => {
          StrudelConfig.getInstance().saveToCache = value
          await this.plugin.saveSettings()
        })
      )
  }
}
