import { WidgetType } from '@codemirror/view'
import { genid } from '@/helpers/vueUtils'
import { GlobalStore } from '@/stores/GlobalStore'
import { Strudel } from '@/entities/Strudel'

export class StrudelHeaderWidget extends WidgetType {
  private instance: Strudel

  constructor(code: string, filePath: string, lineFrom: number) {
    super()

    this.instance = new Strudel({
      id: genid(),
      code,
      filePath,
      lineFrom,
    })
  }

  getInstance() {
    return this.instance
  }

  // should be called before any DOM updates
  updateInstance(newInstance: Strudel) {
    this.instance = newInstance
  }

  toDOM() {
    const container = document.createElement('div')
    container.id = this.instance.id

    container.createDiv({ attr: { 'data-strudel-id': this.instance.id } })

    if (!GlobalStore.getInstance().strudelBlocks.value.find((t) => t.id === this.instance.id)) {
      GlobalStore.getInstance().strudelBlocks.value.push(this.instance)
    }

    return container
  }

  destroy() {
    const store = GlobalStore.getInstance()
    const index = store.strudelBlocks.value.findIndex((t) => t.id === this.instance.id)
    if (index !== -1) {
      // store.strudelBlocks.value[index].cleanup()
      store.strudelBlocks.value.splice(index, 1)
    }
  }

  eq(other: StrudelHeaderWidget) {
    return this.instance.compare(other.instance)
  }

  ignoreEvent() {
    return true
  }
}
