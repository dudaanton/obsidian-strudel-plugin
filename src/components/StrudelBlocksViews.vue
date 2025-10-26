<template>
  <Teleport
    v-for="block in shownStrudelBlocks"
    :key="block.id"
    :to="`[data-strudel-id='${block.id}']`"
  >
    <StrudelBlockView :strudel-block="block as Strudel" />
  </Teleport>
</template>

<script setup lang="ts">
import { GlobalStore } from '@/stores/GlobalStore'
import { Strudel } from '@/entities/Strudel'
import StrudelBlockView from './StrudelBlockView.vue'
import { computed, watch } from 'vue'
import { debounce } from 'obsidian'

const { strudelBlocks } = GlobalStore.getInstance()

const shownStrudelBlocks = computed(() => {
  return strudelBlocks.value.filter((block) => !block.isHidden)
})

const removeHiddenBlocks = debounce(() => {
  for (const [index, block] of strudelBlocks.value.entries()) {
    if (block.isHidden) {
      strudelBlocks.value.splice(index, 1)

      if (GlobalStore.getInstance().currentBlock.value?.id === block.id) {
        GlobalStore.getInstance().stop()
      }
    }
  }
}, 300)

watch(
  strudelBlocks,
  () => {
    removeHiddenBlocks()
  },
  { deep: true }
)
</script>
