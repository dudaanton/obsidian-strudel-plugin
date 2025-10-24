# Obsidian Strudel REPL Plugin

![Obsidian Strudel Plugin Demo](assets/demo.mp4)

<br>

This plugin integrates the incredible live-code music environment, [strudel.cc](https://strudel.cc), into Obsidian. The goal is to make Strudel more accessible and to provide a convenient way to store and play your musical patterns directly within your notes.

**Disclaimer:** I am not affiliated in any way with the developers of Strudel and distribute their code under its AGPL 3.0 license. You can find the entire source code for the Strudel project [here](https://codeberg.org/uzu/strudel).

**Disclaimer 2:** Please be aware that this plugin executes arbitrary JavaScript code from your notes, which carries inherent risks. Do not copy-paste code into your vault unless you understand what it does.

## Features

- A player for Strudel patterns
- Syntax highlighting, including highlighting of the currently playing part
- Sample caching and local playback
- A visual feedback widget
- Support for Obsidian's native themes

## Technical Details

Most of Strudel's code has been left unchanged. I had to include its source code in the project instead of using the pre-built npm packages because those packages are not sufficiently sandboxed and execute network-loaded code, which violates Obsidian's plugin security policy. Here’s what has been changed or added:

- Obsidian's native editor is used instead of Strudel's default. The CodeMirror plugin that Strudel uses for highlighting the currently playing pattern has been slightly adapted for Obsidian’s editor.
- Play/stop/reload buttons are added above the `strudel` code block, allowing you to control playback in Obsidian's live-preview mode.
- For visualization, only the `pianoroll` widget is currently included. It adapts to your Obsidian theme, so color customization from code is not supported at the moment.
- Sample caching and local playback. You can configure the plugin to download assets to a specified folder. After the first download, samples will be played from your disk. In theory, you can also use your own local samples, but I haven't had a chance to test and document this feature yet.
- Sample preloading. To avoid specifying sample paths in every code block, you can define them globally in the settings. By default, it includes the essential samples compiled by felixroos: [https://github.com/felixroos/dough-samples](https://github.com/felixroos/dough-samples).
- Removed pollution of the `globalThis` object; a dedicated `scope` object is used instead. Also, the loading and `eval` of remote JS files for audio fonts (from [here](https://github.com/felixroos/webaudiofontdata)) have been removed. Instead, the plugin now loads a pre-compiled JSON from [here](https://github.com/dudaanton/webaudiofontdata).
- Added syntax highlighting for `strudel` code blocks, based on the work from [here](https://github.com/deathau/cm-editor-syntax-highlight-obsidian).

### Known Limitations

Functionality differs between the official website and this plugin. Not all packages have been included, so some features (like gamepad support) may not work. I also haven't been able to test MIDI device functionality.

Mobile Support: The plugin does not play audio on iOS. This is likely due to limitations in Safari's WebView, as playback also fails in the mobile Safari browser. However, I have kept the plugin enabled for mobile devices, as it should work correctly on Android.

## Installation

While the plugin is awaiting approval in the community plugin list, you can install it manually by downloading it from the "Releases" section of this page. In your vault, inside the `.obsidian/plugins` folder, create a new folder named `obsidian-strudel-plugin` and place the downloaded files there.

After that, reload the community plugins list, and "Strudel REPL" should appear.

### Installation from BRAT (for pre-releases)

You can also install the plugin via the BRAT community plugin. In BRAT's settings, add `dudaanton/obsidian-strudel-plugin` to the list of beta plugins. This will allow you to get early updates before they are officially released.

## Configuration

In the settings, you can specify a folder for caching audio samples and their map files (JSONs), for example, `Attachments/Sounds`. If you enable the `Save to cache` toggle, samples downloaded during playback will be saved to this folder. Otherwise, only already cached samples will be played from the cache, while others will be downloaded on each use.

You can also specify sources for samples in the settings, one per line. For more information on supported formats and links, please refer to the official documentation: [https://strudel.cc/learn/samples/](https://strudel.cc/learn/samples/).
By default, samples from [felixroos/dough-samples](https://github.com/felixroos/dough-samples) are included, but you can remove them or add your own. Specifying these links in the settings saves you from having to declare them in every new code block.

## Usage

Simply add a `strudel` code block to any note like this:
\`\`\`strudel
// your strudel code
\`\`\`

A `play` button will appear above it. Try adding some examples from the official website's workshop to see how it works: [https://strudel.cc/workshop/getting-started/](https://strudel.cc/workshop/getting-started/).

The official Strudel website also offers high-quality tutorials to help you learn how to write your own musical patterns.

## Building from Source

Clone the repository and navigate into it:
```sh
git clone https://github.com/dudaanton/obsidian-strudel-plugin/
cd obsidian-strudel-plugin
```

Copy the `.env.example` file to `.env`:
```sh
cp .env.example .env
```

Edit the `.env` file in any text editor, setting the `TARGET_VAULT_DIR` variable to the path of the plugin folder in your vault, for example, `/Users/myname/obsidian/.obsidian/plugins/strudel`.

Then, run the script to install dependencies, build the project, and copy the final files to that folder:
```sh
npm run deploy:prod
```
