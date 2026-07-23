<template>
  <div class="main-container">
    <div class="card">
      <div class="card-header">
        <h3 class="mb-0">
          <font-awesome-icon :icon="['fas', 'clipboard-check']"/>
          Kopfzählung — Gruppe {{ groupId }}
        </h3>
      </div>
      <div class="card-body">
        <div v-if="loadingInitialData" class="text-center py-5">
          <div class="spinner-border mb-3" role="status">
            <span class="visually-hidden">Wird geladen...</span>
          </div>
          <p class="text-muted">Lade Kinderdaten...</p>
        </div>

        <div v-else-if="loadError" class="text-center py-5">
          <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-danger mb-3" size="2x"/>
          <p class="text-muted">{{ loadError }}</p>
          <button class="btn btn-outline-primary" @click="loadInitialData">
            <font-awesome-icon :icon="['fas', 'redo']"/>
            Erneut versuchen
          </button>
        </div>

        <div v-else>
          <ul class="list-group list-group-flush children-list">
            <li v-if="children.length === 0" class="list-group-item text-center text-muted">
              Keine Kinder in dieser Gruppe.
            </li>

            <li v-for="child in children" :key="child.id"
                class="list-group-item d-flex justify-content-between align-items-center flex-wrap"
                :class="{ 'bg-danger-subtle' : !child.presentNow }">
              <div>
                <strong>{{ child.name }}</strong> ({{ child.age }} J.)
                <div v-if="!child.presentNow" class="text-danger small fw-bold">
                  <font-awesome-icon :icon="['fas', 'times']"/>
                  Fehlt
                </div>
                <div v-if="child.error" class="text-danger small">{{ child.error }}</div>
              </div>

              <div class="d-flex align-items-center gap-3">
                <span class="badge" :class="child.presenceMorning ? 'bg-success' : 'bg-secondary'" title="Anwesend am Morgen">
                  <font-awesome-icon :icon="['fas', child.presenceMorning ? 'check' : 'times']"/>
                  Morgens
                </span>

                <div class="form-check form-switch mb-0">
                  <input class="form-check-input" type="checkbox"
                         :id="`present-now-${child.id}`"
                         v-model="child.presentNow"
                         :disabled="child.updating"
                         @change="onTogglePresentNow(child)">
                  <label class="form-check-label" :for="`present-now-${child.id}`">Jetzt anwesend</label>
                </div>
              </div>
            </li>
          </ul>

          <div class="d-grid gap-2 mt-4">
            <button class="btn btn-secondary btn-lg" @click="goBack">
              <font-awesome-icon :icon="['fas', 'arrow-left']"/>
              Zurück
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {useChildren} from '@/composables/useChildren'
import {useChildPresence} from '@/composables/useChildPresence'
import {useUserStore} from '@/stores/user'

export default {
  name : 'HeadcountView',
  setup() {
    const userStore = useUserStore()
    const { fetchChildrenByGroup } = useChildren()
    const { getTodayGroupPresence, setPresentNow } = useChildPresence()
    return { userStore, fetchChildrenByGroup, getTodayGroupPresence, setPresentNow }
  },

  data() {
    return {
      groupId : null,
      loadingInitialData : true,
      loadError : null,
      children : []
    }
  },

  async created() {
    if (!this.userStore.userInfo.user_id) {
      await this.userStore.loadUser()
    }
    this.groupId = this.userStore.userInfo.group_id

    if (!this.groupId) {
      this.loadingInitialData = false
      this.loadError = 'Ihnen ist heute keine Gruppe zugewiesen. Kopfzählung ist nicht möglich.'
      return
    }

    await this.loadInitialData()
  },

  methods : {
    async loadInitialData() {
      this.loadingInitialData = true
      this.loadError = null
      try {
        const [childrenList, presenceMap] = await Promise.all([
          this.fetchChildrenByGroup(this.groupId),
          this.getTodayGroupPresence(this.groupId)
        ])

        this.children = childrenList.map(child => {
          const presence = presenceMap.get(child.id)
          const presenceMorning = presence ? presence.presence_morning === 1 : false
          const presentNow = presence ? presence.presence_now === 1 : presenceMorning

          return {
            ...child,
            presenceMorning,
            presentNow,
            updating : false,
            error : null
          }
        })
      } catch (error) {
        this.loadError = `Fehler beim Laden der Kopfzählung: ${error.message}`
      } finally {
        this.loadingInitialData = false
      }
    },

    async onTogglePresentNow(child) {
      const desired = child.presentNow
      child.updating = true
      child.error = null
      try {
        await this.setPresentNow(child.id, this.groupId, desired, this.userStore.userInfo.id)
      } catch (error) {
        child.presentNow = !desired
        child.error = `Fehler beim Speichern: ${error.message}`
      } finally {
        child.updating = false
      }
    },

    goBack() {
      this.$router.push('/main')
    }
  }
}
</script>

<style scoped>
.main-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background-color: #f8f9fa;
}

.card {
  width: 100%;
  max-width: 650px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.card-header {
  background-color: #007bff;
  color: white;
  padding: 1.5rem;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-header h3 {
  font-weight: 600;
}

.children-list {
  border: 1px solid #dee2e6;
  border-radius: 0.25rem;
  padding: 0;
}

.list-group-item {
  padding: 15px 20px;
  font-size: 1.1em;
  transition: background-color 0.3s;
}

.btn-secondary {
  background-color: #6c757d;
  border-color: #6c757d;
}

.btn-secondary:hover {
  background-color: #5a6268;
  border-color: #545b62;
}
</style>
