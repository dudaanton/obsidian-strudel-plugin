<template>
  <Teleport v-for="block in strudelBlocks" :key="block.id" :to="`[data-strudel-id='${block.id}']`">
    <StrudelBlockView :strudel-block="block as Strudel" />
  </Teleport>
</template>

<script setup lang="ts">
import { GlobalStore } from '@/stores/GlobalStore'
import { Strudel } from '@/entities/Strudel'
import StrudelBlockView from './StrudelBlockView.vue'

const { strudelBlocks } = GlobalStore.getInstance()
</script>
