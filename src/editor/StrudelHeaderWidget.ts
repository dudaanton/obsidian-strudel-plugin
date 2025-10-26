import { WidgetType } from '@codemirror/view'
import { GlobalStore } from '@/stores/GlobalStore'
import { Strudel } from '@/entities/Strudel'

export class StrudelHeaderWidget extends WidgetType {
  private strudelBlock: Strudel

  constructor(strudelBlock: Strudel) {
    super()

    this.strudelBlock = strudelBlock
  }

  getBlock() {
    return this.strudelBlock
  }

  toDOM() {
    const container = document.createElement('div')
    container.id = this.strudelBlock.id

    container.createDiv({ attr: { 'data-strudel-id': this.strudelBlock.id } })

    if (!GlobalStore.getInstance().strudelBlocks.value.find((t) => t.id === this.strudelBlock.id)) {
      GlobalStore.getInstance().strudelBlocks.value.push(this.strudelBlock)
    }

    // In some cases, CodeMirror renders a widget immediately after its removal,
    // deleting the container from the DOM. This means Vue doesn't have enough time
    // to unmount the component from the old container.
    // To avoid this issue, we render the block with a slight delay.
    setTimeout(() => {
      this.strudelBlock.show()
    })

    return container
  }

  destroy() {
    const store = GlobalStore.getInstance()

    store.strudelBlocks.value.find((t) => t.id === this.strudelBlock.id)?.hide()
  }

  eq(other: StrudelHeaderWidget) {
    return this.strudelBlock.id === other.strudelBlock.id
  }

  ignoreEvent() {
    return true
  }
}
