<template>
  <div class="card h-100 shadow-sm border-0">
    <div class="card-body d-flex flex-column">
      <router-link :to="`/posts/${post.id}`" class="text-decoration-none text-dark mb-2">
        <h2 class="h5 card-title">{{ post.title }}</h2>
      </router-link>

      <p class="card-text text-muted mb-3">
        {{ getContentPreview(post.content) }}
      </p>

      <div class="mt-auto pt-3 border-top d-flex justify-content-between align-items-center small text-muted">
        <span>Beitrag #{{ post.id }}</span>
        <router-link :to="`/posts/${post.id}`" class="text-primary text-decoration-none fw-medium">
          Vollständig lesen →
        </router-link>
      </div>
    </div>
  </div>
</template>


<script setup>
// Props für die Post-Daten definieren
const props = defineProps({
  post: {
    type: Object,
    required: true,
    validator: (post) => {
      return post && typeof post.id === 'number' && 
             typeof post.title === 'string' && 
             typeof post.content === 'string'
    }
  }
})

// Funktion für die Inhaltsvorschau (erste 100 Zeichen)
const getContentPreview = (content) => {
  if (content.length <= 100) {
    return content
  }
  return content.substring(0, 100) + '...'
}
</script>

