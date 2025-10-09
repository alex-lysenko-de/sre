<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-4">👤 Config</h1>

    <div v-if="loading">Loading...</div>
    <div v-else>
      <ul>
        <li v-for="item in items" :key="item.key" class="border-b py-2">
          <strong>{{ item.key }} - {{ item.value }}</strong> — {{ item.description }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const items = ref([])
const loading = ref(true)

onMounted(async () => {
  const { data, error } = await supabase.from('config').select('*')

  if (error) {
    console.error('Fehler beim Laden:', error.message)
  } else {
    items.value = data
  }
  loading.value = false
})
</script>

<style scoped>
ul {
  list-style-type: none;
  padding: 0;
}
</style>