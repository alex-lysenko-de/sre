<template>
  <div class="container py-4">
    <div class="row justify-content-center">
      <div class="col-12 col-lg-10 col-xl-8">
        <div class="card shadow border-0 rounded-4">
          <div class="card-body p-4 p-md-5">
            <!-- Header -->
            <h1 class="display-5 fw-bold text-success text-center mb-4">
              Über uns
            </h1>

            <!-- Content -->
            <div class="fs-6 text-secondary lh-lg">
              <p>
                Wir freuen uns, Sie in unserer App zur Organisation der Kinderfreizeit begrüßen zu dürfen!
                Hier erhalten Sie alle aktuellen Informationen zu Gruppen, Bussen und Zeitplänen.
              </p>

              <p>
                Unsere Spezialisten bemühen sich, den Prozess so transparent wie möglich zu gestalten, damit sich jeder Elternteil
                sicher und jedes Kind wohl fühlt.
              </p>
            </div>

            <!-- Contact Card -->
            <div class="card bg-success bg-opacity-10 border-success border-2 rounded-3 mt-4 shadow-sm">
              <div class="card-body p-4 text-center">
                <h2 class="h5 fw-bold text-success mb-3">
                  Kontaktieren Sie uns
                </h2>
                <p class="mb-2 text-secondary">
                  Telefonkontakt:
                </p>
                <a 
                  v-if="config.public_phone_number" 
                  :href="`tel:${config.public_phone_number}`" 
                  class="btn btn-success btn-lg fw-semibold d-inline-flex align-items-center gap-2"
                >
                  📞 {{ config.public_phone_number }}
                </a>
                <div v-else class="text-muted">
                  <div class="spinner-border spinner-border-sm me-2" role="status">
                    <span class="visually-hidden">Laden...</span>
                  </div>
                  Wird geladen...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useConfig } from '../modules/config'

const { config, initConfigModule, loadConfig } = useConfig()

onMounted(async () => {
  await initConfigModule()
  await loadConfig()
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