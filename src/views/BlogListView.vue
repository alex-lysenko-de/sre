<template>
  <div class="container py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h1 class="mb-0">Blog</h1>
      <button @click="handleClearStorage" class="btn btn-danger">
        Speicher löschen
      </button>
    </div>

    <!-- Formular zum Hinzufügen neuer Beiträge -->
    <PostForm @add-post="handleAddPost" />

    <!-- Beitragssuche -->
    <SearchBar @update:searchTerm="searchTerm = $event" />

    <!-- Beitragsliste -->
    <div class="mt-4">
      <div v-if="filteredPosts.length === 0 && searchTerm" class="text-center text-muted py-5 fst-italic">
        <p class="mb-0">Keine Suchergebnisse für "{{ searchTerm }}" gefunden</p>
      </div>

      <div v-else-if="filteredPosts.length === 0" class="text-center text-muted py-5 fst-italic">
        <p class="mb-0">Noch keine Beiträge vorhanden. Fügen Sie den ersten Beitrag hinzu!</p>
      </div>

      <div v-else class="row g-4">
        <div class="col-12 col-md-6 col-lg-4"
             v-for="post in filteredPosts"
             :key="post.id">
          <BlogPostCard :post="post" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { blogStore } from '../store/blogStore.js'
import SearchBar from '../components/SearchBar.vue'
import BlogPostCard from '../components/BlogPostCard.vue'
import PostForm from '../components/PostForm.vue'

export default {
  name: 'BlogListView',
  components: {
    PostForm,
    SearchBar,
    BlogPostCard
  },
  data() {
    return {
      searchTerm: ''
    }
  },
  computed: {
    // Blogbeiträge werden jetzt aus dem zentralen Store bezogen
    allPosts() {
      return blogStore.posts
    },
    filteredPosts() {
      if (!this.searchTerm) {
        return this.allPosts
      }
      
      return this.allPosts.filter(post => 
        post.title.toLowerCase().includes(this.searchTerm.toLowerCase())
      )
    }
  },
  methods: {
    handleAddPost(newPost) {
      blogStore.addPost(newPost)
    },
    handleClearStorage() {
      // In einer echten Anwendung wäre hier eine Bestätigung sinnvoll
      blogStore.clearLocalStorage();
    }
  },
  mounted() {
    // Dieser Aufruf stellt sicher, dass beim ersten Laden gespeichert wird,
    // falls der Speicher noch leer ist.
    blogStore.savePostsToLocalStorage()
  }
}
</script>
