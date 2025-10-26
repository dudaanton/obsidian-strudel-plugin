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
  </div>
</template>

<script setup lang="ts">
import ObsidianIcon from './obsidian/Icon.vue'
import { Strudel } from '@/entities/Strudel'
import { computed, onMounted, ref } from 'vue'
import { GlobalStore } from '@/stores/GlobalStore'

const props = defineProps<{
  strudelBlock: Strudel
}>()

const { isPlaying, currentBlock } = GlobalStore.getInstance()

const isCurrentBlockPlaying = computed(() => {
  return isPlaying.value && currentBlock.value?.id === props.strudelBlock.id
})

const canvas = ref<HTMLCanvasElement | null>(null)

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
