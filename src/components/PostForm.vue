<template>
  <div class="bg-light p-4 rounded mb-4">
    <h3 class="mb-4 text-dark">Neuen Beitrag hinzufügen</h3>
    <form @submit.prevent="submitPost">
      <div class="mb-3">
        <label for="title" class="form-label fw-bold">Titel:</label>
        <input
          id="title"
          type="text"
          v-model="newPostTitle"
          required
          placeholder="Geben Sie den Beitragstitel ein"
          class="form-control"
        />
      </div>

      <div class="mb-3">
        <label for="content" class="form-label fw-bold">Inhalt:</label>
        <textarea
          id="content"
          v-model="newPostContent"
          required
          placeholder="Geben Sie den Beitragsinhalt ein"
          rows="4"
          class="form-control"
        ></textarea>
      </div>

      <button type="submit" class="btn btn-primary">Beitrag hinzufügen</button>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'PostForm',
  emits: ['add-post'],
  setup(props, { emit }) {
    const newPostTitle = ref('')
    const newPostContent = ref('')

    const submitPost = () => {
      // Überprüfen, ob Felder ausgefüllt sind
      if (newPostTitle.value.trim() && newPostContent.value.trim()) {
        // Neues Beitragsobjekt mit eindeutiger ID erstellen
        const newPost = {
          id: Date.now(), // Einfache Methode zur ID-Generierung
          title: newPostTitle.value.trim(),
          content: newPostContent.value.trim()
        }
        
        // Event für Elternkomponente auslösen
        emit('add-post', newPost)
        
        // Formularfelder zurücksetzen
        newPostTitle.value = ''
        newPostContent.value = ''
      }
    }

    return {
      newPostTitle,
      newPostContent,
      submitPost
    }
  }
}
</script>

