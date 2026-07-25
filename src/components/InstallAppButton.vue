// src/components/InstallAppButton.vue

<template>
  <button
      v-if="installPromptStore.showButton"
      class="btn btn-sm btn-warning d-flex align-items-center gap-2"
      title="App installieren"
      @click="installPromptStore.promptInstall()"
  >
    📲 App installieren
  </button>
</template>

<script setup>
import { useInstallPromptStore } from '@/stores/installPrompt'

const installPromptStore = useInstallPromptStore()
</script>
