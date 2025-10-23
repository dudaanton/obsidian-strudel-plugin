<template>
  <div class="strudel-block">
    <div class="strudel-block__header">
      <ObsidianIcon
        :icon="isCurrentBlockPlaying ? 'circle-stop' : 'play'"
        @click="isCurrentBlockPlaying ? stop() : play()"
      />
      <ObsidianIcon v-if="isCurrentBlockPlaying" icon="refresh-ccw" @click="play()" />
    </div>
    <canvas v-show="isCurrentBlockPlaying" ref="canvas"></canvas>
    <!-- <div ref="editorRef"></div> -->
  </div>
</template>

<script setup lang="ts">
import ObsidianIcon from './obsidian/Icon.vue'
import { Strudel } from '@/entities/Strudel'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { initStrudel } from '@/strudel/init.js'
import { GlobalStore } from '@/stores/GlobalStore'
import { updateMiniLocations } from '@/editor/StrudelHighlight'
import { MarkdownView, WorkspaceLeaf } from 'obsidian'
import { EditorView } from '@codemirror/view'

const props = defineProps<{
  strudelBlock: Strudel
}>()

const editorRef = ref<HTMLElement | null>(null)

const { isPlaying, currentBlock } = GlobalStore.getInstance()

const isCurrentBlockPlaying = computed(() => {
  return isPlaying.value && currentBlock.value?.id === props.strudelBlock.id
})

watch(
  () => props.strudelBlock,
  (newBlock) => {
    if (isCurrentBlockPlaying.value) {
      console.log(GlobalStore.getInstance().repl)
      // GlobalStore.getInstance().repl.setCode(newBlock.code)
      // GlobalStore.getInstance().resetMiniLocations()
    }
  },
  { deep: true }
)

const canvas = ref<HTMLCanvasElement | null>(null)

//
// const editor = new StrudelMirror({
//   defaultOutput: webaudioOutput,
//   getTime: () => getAudioContext().currentTime,
//   transpiler,
//   root: document.getElementById('editor'),
//   initialCode: funk42,
//   drawTime,
//   onDraw: (haps, time) => drawPianoroll({ haps, time, ctx: drawContext, drawTime, fold: 0 }),
//   prebake: async () => {
//     initAudioOnFirstClick(); // needed to make the browser happy (don't await this here..)
//     const loadModules = evalScope(
//       import('@strudel/core'),
//       import('@strudel/draw'),
//       import('@strudel/mini'),
//       import('@strudel/tonal'),
//       import('@strudel/webaudio'),
//     );
//     await Promise.all([loadModules, registerSynthSounds(), registerSoundfonts()]);
//   },
// });
//
// document.getElementById('play').addEventListener('click', () => editor.evaluate());
// document.getElementById('stop').addEventListener('click', () => editor.stop());

const test = () => {
  const activeLeaf = GlobalStore.getInstance()
    .app.workspace.getLeavesOfType('markdown')
    .find(
      (leaf: WorkspaceLeaf) =>
        (leaf.view as MarkdownView).file?.path === props.strudelBlock.filePath
    )

  const view = activeLeaf?.view as MarkdownView

  if (activeLeaf && view.editor) {
    console.log('found editor for strudel block')
    // updateMiniLocations((view.editor as any).cm as EditorView, [])
  }
}

const play = () => {
  GlobalStore.getInstance().play(props.strudelBlock)
}

const stop = () => {
  GlobalStore.getInstance().stop()
}

onMounted(() => {
  const drawContext = canvas.value.getContext('2d')

  props.strudelBlock.setDrawContext(drawContext)
})

onUnmounted(() => {
  stop()
})
</script>

<style>
.strudel-block .strudel-block__header {
  display: flex;
  align-items: center;
}
.strudel-block canvas {
  width: var(--file-line-width);
  height: 80px;
}
</style>
