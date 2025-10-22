import { Prec } from '@codemirror/state';
import { keymap, ViewPlugin } from '@codemirror/view';
// import { searchKeymap } from '@codemirror/search';
import { emacs } from '@replit/codemirror-emacs';
import { vim } from '@replit/codemirror-vim';
// import { vim } from './vim_test.mjs';
import { vscodeKeymap } from '@replit/codemirror-vscode-keymap';
import { defaultKeymap } from '@codemirror/commands';

const vscodePlugin = ViewPlugin.fromClass(
  class {
    constructor() {}
  },
  {
    provide: () => {
      return Prec.highest(keymap.of([...vscodeKeymap]));
    },
  },
);
const vscodeExtension = (options) => [vscodePlugin].concat(options ?? []);

const keymaps = {
  vim,
  emacs,
  codemirror: () => keymap.of(defaultKeymap),
  vscode: vscodeExtension,
};

export function keybindings(name) {
  const active = keymaps[name];
  return [active ? Prec.high(active()) : []];
}
