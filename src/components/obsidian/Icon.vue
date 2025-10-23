<template>
  <div
    class="strudel-obsidian-icon"
    :class="{
      'strudel-obsidian-icon_with-bg': withBg,
      'strudel-obsidian-icon_no-hover': noHover,
    }"
    @click="emit('click', $event)"
  >
    <div v-if="textLeft" class="strudel-obsidian-icon__text">{{ textLeft }}</div>
    <div v-if="icon" ref="iconEl" class="strudel-obsidian-icon__icon" />
    <div v-if="textRight" class="strudel-obsidian-icon__text">{{ textRight }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { setIcon } from 'obsidian'

const props = defineProps<{
  icon?: string
  textLeft?: string
  textRight?: string
  withBg?: boolean
  noHover?: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const iconEl = ref<HTMLElement>()

const updateIcon = () => {
  if (iconEl.value) {
    iconEl.value.empty()
    if (props.icon) {
      setIcon(iconEl.value, props.icon)
    }
  }
}

onMounted(updateIcon)
watch(() => props.icon, updateIcon)
</script>

<style lang="scss">
.strudel-obsidian-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.5em;
  color: var(--icon-color);
  padding: var(--size-2-1) var(--size-2-2);
  border-radius: var(--radius-s);

  &_with-bg {
    background-color: var(--background-secondary);
  }
  &:hover {
    cursor: var(--cursor-link);
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
  }
  &_no-hover {
    &:hover {
      cursor: default;
      color: var(--icon-color);
      background-color: transparent;
    }
  }
}

.strudel-obsidian-icon__icon {
  display: flex;
  align-items: center;
  height: 1.5em;
}

.strudel-obsidian-icon__text {
  user-select: none;
  font-size: var(--font-smaller);

  &:first-child {
    margin-right: var(--size-2-2);
  }

  &:last-child {
    margin-left: var(--size-2-2);
  }
}
</style>
