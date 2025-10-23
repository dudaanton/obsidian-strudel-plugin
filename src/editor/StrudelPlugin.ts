import { StateField, RangeSetBuilder, EditorState } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import { editorLivePreviewField, editorInfoField } from 'obsidian'
import { StrudelHeaderWidget } from './StrudelHeaderWidget'
import { STRUDEL_CODEBLOCK_KEYWORD } from '@/constants/keywords'
import { GlobalStore } from '@/stores/GlobalStore'

function buildStrudelDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  if (!state.field(editorLivePreviewField)) {
    return builder.finish()
  }

  const currentFile = state.field(editorInfoField)?.file
  if (!currentFile) {
    return builder.finish()
  }

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)

    if (line.text.trim() === `\`\`\`${STRUDEL_CODEBLOCK_KEYWORD}`) {
      const codeLines = []
      let endLineFound = false

      // find the end of the code block and collect code lines
      let endLineNumber = i + 1
      while (endLineNumber <= state.doc.lines) {
        const endLine = state.doc.line(endLineNumber)
        if (endLine.text.trim() === '```') {
          endLineFound = true
          break
        }
        codeLines.push(endLine.text)
        endLineNumber++
      }

      if (!endLineFound) {
        continue // skip if no closing ```
      }

      const code = codeLines.join('\n')

      if (!code.trim()) {
        continue // skip empty code blocks
      }

      const widget = new StrudelHeaderWidget(code, currentFile.path, state.doc.line(i + 1).from)

      // searching for existing instance
      const existingInstance = GlobalStore.getInstance().strudelBlocks.value.find((s) =>
        s.compare(widget.getInstance())
      )

      if (existingInstance) {
        existingInstance.code = code
        existingInstance.lineFrom = state.doc.line(i + 1).from
        // update instance at newly created widget
        widget.updateInstance(existingInstance)
      }

      // add widget at the start of the code block
      builder.add(
        line.from,
        line.from,
        Decoration.widget({
          widget,
          block: true,
          side: -1,
        })
      )
    }
  }

  return builder.finish()
}

export const strudelStateField = StateField.define<DecorationSet>({
  create(state) {
    return buildStrudelDecorations(state)
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
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
