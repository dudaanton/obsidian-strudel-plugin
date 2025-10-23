import { STRUDEL_CODEBLOCK_KEYWORD } from '@/constants/keywords'
import { Editor, Notice } from 'obsidian'

export const createStrudelBlock = async (editor: Editor) => {
  if (!editor) {
    new Notice('No active markdown editor found.', 3000)
    return
  }

  const cursor = editor.getCursor()
  const shouldCreateNewLine = cursor.ch > 0
  const selection = editor.getSelection()

  const strudelBlock = `\`\`\`${STRUDEL_CODEBLOCK_KEYWORD}

\`\`\``


  if (selection) {
    editor.replaceSelection(strudelBlock)
  } else {
    // If no selection, just insert the linkPath at the cursor position
    editor.replaceRange(strudelBlock, cursor)
  }

  // setting cursor to the line inside the new strudel block
  editor.setSelection({ line: cursor.line + (shouldCreateNewLine ? 2 : 1), ch: 0 })
}
