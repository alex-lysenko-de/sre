<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-lg-10 col-xl-8">
        <div class="card shadow border-0 rounded-4">
          <div class="card-body p-4 p-md-5">
            <!-- Header -->
            <h1 class="display-5 fw-bold text-success text-center mb-4">
              Stadtranderholung Selm
            </h1>

            <div class="text-danger fw-bold fs-5 mb-3">
              WICHTIG!
            </div>

            <p class="fs-5 text-dark mb-4">
              Falls Sie ein Kind gefunden haben, rufen Sie bitte sofort diese Nummer an:
            </p>

            <!-- Contact Card -->
            <div class="card bg-success bg-opacity-10 border-success border-2 rounded-3 mt-4 shadow-sm">
              <div class="card-body p-4 text-center">

                <a
                    v-if="configStore.config.public_phone_number"
                    :href="`tel:${configStore.config.public_phone_number}`"
                    class="btn btn-success btn-lg fw-semibold d-inline-flex align-items-center gap-2"
                >
                  <font-awesome-icon :icon="['fas', 'phone']"/>
                  {{ configStore.config.public_phone_number }}
                </a>
                <div v-else class="text-muted">
                  <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Laden...</span>
                  </div>
                  Wird geladen...
                </div>
              </div>
            </div>

            <div class="mt-4 text-muted">
              Vielen Dank für Ihre Hilfe!
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { onMounted } from 'vue'
import { useConfigStore } from '@/stores/config'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// Use Pinia store
const configStore = useConfigStore()

onMounted(async () => {
  // Load configuration on mount

})
</script>

<style scoped>
.rounded-4 {
  border-radius: 1rem;
}

.rounded-3 {
  border-radius: 0.75rem;
}

.lh-lg {
  line-height: 1.8;
}
</style>