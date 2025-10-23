import { Strudel } from '@/entities/Strudel'
import { App } from 'obsidian'
import { ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { MarkdownView, WorkspaceLeaf } from 'obsidian'
import { initStrudel as init, recalculateMiniLocations } from '@/strudel/init.js'
import { highlightMiniLocations, updateMiniLocations } from '@/editor/StrudelHighlight'
import { Drawer, drawPianoroll } from '@/strudel/draw/index.mjs'

export class GlobalStore {
  private static instance: GlobalStore
  private _app: App

  public repl: any
  public readonly strudelInitialized = ref(false)

  public readonly initialized = ref(false)
  public readonly currentFile = ref(null)

  public readonly strudelBlocks = ref<Strudel[]>([])

  public static getInstance(): GlobalStore {
    if (!GlobalStore.instance) {
      GlobalStore.instance = new GlobalStore()
    }
    return GlobalStore.instance
  }

  public get app(): App {
    return this._app
  }

  public getActiveEditor() {
    const activeLeaf = GlobalStore.getInstance()
      .app.workspace.getLeavesOfType('markdown')
      .find(
        (leaf: WorkspaceLeaf) =>
          (leaf.view as MarkdownView).file?.path === this.currentBlock.value?.filePath
      )

    const view = activeLeaf?.view as MarkdownView

    if (activeLeaf && view.editor) {
      return (view.editor as any).cm as EditorView
    }
  }

  public readonly currentBlock = ref<Strudel | null>(null)
  public readonly isPlaying = ref(false)

  public play(strudelBlock: Strudel) {
    this.currentBlock.value = strudelBlock
    this.repl.evaluate(strudelBlock.code)
    this.isPlaying.value = true
  }

  public stop() {
    this.repl.stop()
    this.isPlaying.value = false
  }

  public drawer: any | null = null

  // public resetMiniLocations() {
  //   const editor = this.getActiveEditor()
  //   if (this.currentBlock.value && editor) {
  //     updateMiniLocations(this.getActiveEditor(), [])
  //   }
  // }

  // public recalculateMiniLocations() {
  //   if (this.currentBlock.value) {
  //     const locations = recalculateMiniLocations(this.currentBlock.value.code)
  //     updateMiniLocations(this.getActiveEditor(), locations || [])
  //   }
  // }

  public async initStrudel() {
    this.repl = await init({
      afterEval: (options: any) => {
        // console.log('afterEval', options.meta?.miniLocations)
        if (options.meta?.miniLocations) {
          const locations = options.meta.miniLocations
          // for (const loc of locations) {
          //   loc[0] = loc[0] + this.currentBlock.lineFrom
          //   loc[1] = loc[1] + this.currentBlock.lineFrom
          // }
          const editor = this.getActiveEditor()
          if (this.currentBlock.value && editor) {
            this.currentBlock.value.playbackStarted()
            updateMiniLocations(editor, locations || [], this.currentBlock.value.lineFrom)
          }
        }

        const drawTime = [-2, 2]
        this.drawer.setDrawTime(drawTime)
        // invalidate drawer after we've set the appropriate drawTime
        this.drawer.invalidate(this.repl.scheduler)
      },
      onToggle: (started: boolean) => {
        console.log('onToggle', started)
        if (started) {
          this.currentBlock.value.playbackStarted()
          this.drawer.start(this.repl.scheduler)
          // if (this.solo) {
          //   // stop other repls when this one is started
          //   document.dispatchEvent(
          //     new CustomEvent('start-repl', {
          //       detail: this.id,
          //     })
          //   )
          // }
        } else {
          this.drawer.stop()

          const editor = this.getActiveEditor()
          console.log('playback stopped')
          if (editor) {
            this.currentBlock.value?.playbackStopped()
            console.log('clearing mini locations')
            updateMiniLocations(editor, [], 0)
          }

          this.currentBlock.value = null
        }
      },
    })
    console.log(this.repl)
    this.strudelInitialized.value = true

    this.drawer = new Drawer(
      (haps: any, time: any, _: any) => {
        const editor = this.getActiveEditor()
        if (!editor || !this.currentBlock.value) {
          return
        }

        // console.log(this.currentBlock.value.lineFrom)
        const currentFrame = haps.filter((hap: any) => hap.isActive(time))
        highlightMiniLocations(editor, time, currentFrame)

        const rootStyles = getComputedStyle(document.getElementsByTagName('body')[0])
        const playheadColor = rootStyles.getPropertyValue('--text-accent').trim()
        const inactiveColor = rootStyles
          .getPropertyValue('--background-modifier-active-hover')
          .trim()
        const activeColor = rootStyles.getPropertyValue('--text-accent').trim()

        const drawContext = this.currentBlock.value?.drawContext
        if (this.currentBlock.value?.drawContext) {
          drawPianoroll({
            haps,
            time,
            ctx: drawContext,
            drawTime: [-2, 2],
            fold: 1,
            // labels: true,
            playheadColor,
            inactive: inactiveColor,
            active: activeColor,
            fillActive: true,
            strokeActive: false,
          })
        }
      },
      [-2, 2]
    )
  }

  public init(app: App): void {
    if (this.initialized.value) {
      return
    }

    this._app = app

    this.initialized.value = true
  }

  public destroy(): void {
    if (!this.initialized.value) {
      return
    }

    this.initialized.value = false
    this.currentFile.value = null
    this.strudelBlocks.value.splice(0, this.strudelBlocks.value.length)
  }
}
