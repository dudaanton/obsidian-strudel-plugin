import { Strudel } from '@/entities/Strudel'
import { App, Editor } from 'obsidian'
import { ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { MarkdownView, WorkspaceLeaf } from 'obsidian'
import { initStrudel as init, samples } from '@/strudel/init.js'
import { highlightMiniLocations, updateMiniLocations } from '@/editor/StrudelHighlight'
import { Drawer, drawPianoroll } from '@/strudel/draw/index.mjs'
import { StrudelConfig } from '@/services/StrudelConfig'

export class GlobalStore {
  private static instance: GlobalStore
  private _app: App

  public repl: any
  public readonly strudelInitialized = ref(false)

  public readonly initialized = ref(false)

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
      return (view.editor as Editor & { cm: EditorView }).cm as EditorView
    }
  }

  public readonly currentBlock = ref<Strudel | null>(null)
  public readonly isPlaying = ref(false)

  public play(strudelBlock: Strudel) {
    this.currentBlock.value = strudelBlock
    this.repl.evaluate(strudelBlock.code)
    this.isPlaying.value = true
  }

  public playAt(position: number) {
    const currentFile = this.app.workspace.getActiveViewOfType(MarkdownView)?.file

    if (!currentFile) return

    const strudelBlock = this.strudelBlocks.value.find((block) => {
      return block.filePath === currentFile.path && position >= block.from && position <= block.to
    }) as Strudel | undefined

    if (strudelBlock) {
      this.play(strudelBlock)
    }
  }

  public stop() {
    this.repl.stop()
    this.isPlaying.value = false
  }

  public drawer: any | null = null

  public async initStrudel() {
    this.repl = await init({
      afterEval: (options: any) => {
        if (options.meta?.miniLocations) {
          const locations = options.meta.miniLocations
          const editor = this.getActiveEditor()
          if (this.currentBlock.value && editor) {
            updateMiniLocations(editor, locations || [], this.currentBlock.value.codeFrom)
          }
        }

        const drawTime = [-2, 2]
        this.drawer.setDrawTime(drawTime)
        // invalidate drawer after we've set the appropriate drawTime
        this.drawer.invalidate(this.repl.scheduler)
      },
      onToggle: (started: boolean) => {
        if (started) {
          this.drawer.start(this.repl.scheduler)
        } else {
          this.drawer.stop()

          const editor = this.getActiveEditor()
          if (editor) {
            updateMiniLocations(editor, [], 0)
          }

          this.currentBlock.value = null
        }
      },
    })
    samples(StrudelConfig.getInstance().samplesToPreload)
    this.strudelInitialized.value = true

    this.drawer = new Drawer(
      (haps: any, time: any, _: any) => {
        const editor = this.getActiveEditor()
        if (!editor || !this.currentBlock.value) {
          return
        }

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
    this.strudelBlocks.value.splice(0, this.strudelBlocks.value.length)
  }
}
