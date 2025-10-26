import { StateField, RangeSetBuilder, EditorState } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { editorLivePreviewField, editorInfoField } from 'obsidian'
import { StrudelHeaderWidget } from './StrudelHeaderWidget'
import { STRUDEL_CODEBLOCK_KEYWORD } from '@/constants/keywords'
import { genid } from '@/helpers/vueUtils'
import { GlobalStore } from '@/stores/GlobalStore'
import { Strudel } from '@/entities/Strudel'

const findBlocks = (
  state: EditorState,
  from: number = 1,
  to: number = state.doc.length
): StrudelBlockInfo[] => {
  const blocks: StrudelBlockInfo[] = []

  if (state.doc.length === 0) return blocks

  if (from === to) return blocks

  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i)

    if (line.text.trim() === `\`\`\`${STRUDEL_CODEBLOCK_KEYWORD}`) {
      const startPos = line.from
      let endLineNumber = i + 1
      let endPos = startPos

      while (endLineNumber <= state.doc.lines) {
        const endLine = state.doc.line(endLineNumber)
        if (endLine.text.trim() === '```') {
          endPos = endLine.to
          break
        }
        endLineNumber++
      }

      if (endPos > startPos) {
        blocks.push({
          id: genid(),
          from: startPos,
          to: endPos,
        })
      }
    }
  }

  return blocks
}

interface StrudelBlockInfo {
  id: string
  from: number
  to: number
}

const strudelBlocksField = StateField.define<readonly StrudelBlockInfo[]>({
  create(state) {
    return findBlocks(state)
  },
  update(blocks, tr) {
    if (
      !tr.docChanged &&
      tr.state.field(editorLivePreviewField) === tr.startState.field(editorLivePreviewField)
    )
      return blocks

    const oldBlocks: StrudelBlockInfo[] = []

    for (const block of blocks) {
      const newPos = { from: tr.changes.mapPos(block.from), to: tr.changes.mapPos(block.to) }
      // If the block still exists after the change
      if (newPos.from !== newPos.to) {
        oldBlocks.push({ ...block, ...newPos })
      }
    }

    const newBlocks = findBlocks(tr.state)

    for (const newBlock of newBlocks) {
      // If a line is added or removed before a block, its position shifts by 1.
      // Therefore, we look for blocks that match by 'to' and are close by 'from'.
      const existingBlock = oldBlocks.find(
        (oldBlock) =>
          (oldBlock.from === newBlock.from ||
            oldBlock.from - 1 === newBlock.from ||
            oldBlock.from + 1 === newBlock.from) &&
          oldBlock.to === newBlock.to
      )
      if (existingBlock) {
        newBlock.id = existingBlock.id
      }
    }

    return newBlocks
  },
})

const buildStrudelDecorations = (state: EditorState): DecorationSet => {
  const builder = new RangeSetBuilder<Decoration>()
  const blocks = state.field(strudelBlocksField)

  if (!state.field(editorLivePreviewField)) {
    return builder.finish()
  }

  const currentFile = state.field(editorInfoField)?.file
  if (!currentFile) {
    return builder.finish()
  }

  const widgets: StrudelHeaderWidget[] = []

  for (const block of blocks) {
    const code = state.doc.sliceString(
      state.doc.lineAt(block.from).to + 1,
      state.doc.lineAt(block.to).from - 1
    )

    if (!code.trim()) {
      continue
    }

    const codeFrom = state.doc.lineAt(block.from).to + 1

    const existingBlock = GlobalStore.getInstance().strudelBlocks.value.find(
      (t) => t.id === block.id
    ) as Strudel

    if (existingBlock) {
      existingBlock.code = code
      existingBlock.from = block.from
      existingBlock.to = block.to
      existingBlock.codeFrom = codeFrom
    }

    const widget = new StrudelHeaderWidget(
      existingBlock ||
        new Strudel({
          id: block.id,
          code,
          filePath: currentFile.path,
          from: block.from,
          to: block.to,
          codeFrom,
        })
    )

    widgets.push(widget)
  }

  widgets.sort((a, b) => a.getBlock().from - b.getBlock().from)

  for (const widget of widgets) {
    // add widget at the start of the code block
    builder.add(
      widget.getBlock().from,
      widget.getBlock().from,
      Decoration.widget({
        widget,
        block: true,
        side: -1,
      })
    )
  }

  return builder.finish()
}

const strudelStateField = StateField.define<DecorationSet>({
  create(state) {
    return buildStrudelDecorations(state)
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.state.field(editorLivePreviewField) !== tr.startState.field(editorLivePreviewField)
    ) {
      return buildStrudelDecorations(tr.state)
    }

    return decorations.map(tr.changes)
  },
  provide(field) {
    return [EditorView.decorations.from(field)]
  },
})

export const strudelEditorExtension = [strudelBlocksField, strudelStateField]
