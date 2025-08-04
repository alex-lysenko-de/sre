<template>
  <div class="container my-5">
    <div v-if="post" class="card shadow-sm mb-4">
      <div class="card-body">
        <h1 class="card-title h2 mb-3">{{ post.title }}</h1>
        <div class="border-bottom pb-2 mb-4">
          <span class="text-muted">Beitrag #{{ post.id }}</span>
        </div>
        <div class="card-text fs-5">
          <p class="multiline-text">{{ post.content }}</p>
        </div>
      </div>
    </div>

    <div v-else class="card shadow-sm mb-4 text-center">
      <div class="card-body">
        <h1 class="text-danger h3 mb-3">Beitrag nicht gefunden</h1>
        <p class="text-muted fs-5">
          Der angeforderte Beitrag mit der ID {{ $route.params.id }} existiert leider nicht.
        </p>
      </div>
    </div>

    <div class="text-center">
      <router-link to="/" class="btn btn-outline-primary">
        ← Zurück zur Beitragsliste
      </router-link>
    </div>
  </div>
</template>

<script>
import { blogStore } from '../store/blogStore.js'

export default {
  name: 'PostDetailView',
  data() {
    return {
      post: null
    }
  },
  created() {
    this.loadPost()
  },
  methods: {
    loadPost() {
      const postId = this.$route.params.id
      this.post = blogStore.findPostById(postId)
    }
  },
  watch: {
    '$route.params.id': {
      handler(newId) {
        this.post = blogStore.findPostById(newId)
      },
      immediate: true
    }
  }
}
</script>
<style scoped>
  .multiline-text {
  white-space: pre-line;
  }
</style>