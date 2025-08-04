<script>
import { ref } from 'vue'

export default {
  name: 'SearchBar',
  emits: ['update:searchTerm'],
  setup(props, { emit }) {
    const searchTerm = ref('')

    return {
      searchTerm
    }
  }
}
</script>

<template>
  <div class="mb-4">
    <input 
      type="text" 
      v-model="searchTerm" 
      @input="$emit('update:searchTerm', searchTerm)"
      placeholder="Nach Titel suchen..."
      class="form-control"
    />
  </div>
</template>

