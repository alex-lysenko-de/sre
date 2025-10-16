<template>
  <div v-if="show" class="modal fade show d-block" tabindex="-1" style="background-color: rgba(0,0,0,0.5);">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header bg-primary text-white">
          <h5 class="modal-title">
            <font-awesome-icon :icon="['fas', 'child']" />
            {{ isEditing ? 'Kind bearbeiten' : 'Neues Kind hinzufügen' }}
          </h5>
          <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
        </div>

        <div class="modal-body">
          <div id="modalAlertContainer"></div>

          <form @submit.prevent="handleSubmit">
            <div class="mb-3">
              <label for="childName" class="form-label">Name <span class="text-danger">*</span></label>
              <input
                  type="text"
                  id="childName"
                  class="form-control"
                  v-model="formData.name"
                  placeholder="Name des Kindes"
                  required
              >
            </div>

            <div class="row">
              <div class="col-md-4 mb-3">
                <label for="childAge" class="form-label">Alter <span class="text-danger">*</span></label>
                <input
                    type="number"
                    id="childAge"
                    class="form-control"
                    v-model.number="formData.age"
                    placeholder="Alter"
                    min="0"
                    max="99"
                    required
                >
              </div>

              <div class="col-md-4 mb-3">
                <label for="childSchwimm" class="form-label">Schwimmer (Level 0-4) <span class="text-danger">*</span></label>
                <select
                    id="childSchwimm"
                    class="form-select"
                    v-model.number="formData.schwimmer"
                    required
                >
                  <option :value="0">0 - Nichtschwimmer</option>
                  <option :value="1">1 - Seepferdchen</option>
                  <option :value="2">2 - Bronze</option>
                  <option :value="3">3 - Silber</option>
                  <option :value="4">4 - Gold</option>
                </select>
              </div>

              <div class="col-md-4 mb-3">
                <label for="childBandId" class="form-label">Armband Code (optional)</label>
                <input
                    type="text"
                    id="childBandId"
                    class="form-control"
                    v-model="formData.band_id"
                    placeholder="z.B. 123456789"
                >
              </div>
            </div>

            <div class="mb-3">
              <label for="childNotes" class="form-label">Notizen</label>
              <textarea
                  id="childNotes"
                  class="form-control"
                  v-model="formData.notes"
                  placeholder="Besondere Hinweise (Allergien, Medikamente etc.)"
                  rows="3"
              ></textarea>
            </div>

            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-secondary" @click="closeModal">
                Abbrechen
              </button>
              <button type="submit" class="btn btn-primary" :disabled="saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2"></span>
                <font-awesome-icon v-else :icon="['fas', isEditing ? 'save' : 'plus']" class="me-1" />
                {{ isEditing ? 'Speichern' : 'Hinzufügen' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useChildren } from '@/composables/useChildren'

export default {
  name: 'AddEditChildModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    childData: {
      type: Object,
      default: null
    },
    groupId: {
      type: Number,
      required: true
    }
  },
  emits: ['close', 'saved'],
  setup() {
    const { saveChild: saveChildToDb } = useChildren()
    return { saveChildToDb }
  },
  data() {
    return {
      formData: {
        name: '',
        age: '',
        schwimmer: 0,
        notes: '',
        band_id: ''
      },
      saving: false
    }
  },
  computed: {
    isEditing() {
      return this.childData !== null && this.childData.id !== undefined
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        this.initializeForm()
      }
    },
    childData: {
      immediate: true,
      handler() {
        if (this.show) {
          this.initializeForm()
        }
      }
    }
  },
  methods: {
    initializeForm() {
      if (this.isEditing) {
        // Edit mode - fill form with existing data
        this.formData = {
          name: this.childData.name || '',
          age: this.childData.age || '',
          schwimmer: this.childData.schwimmer || 0,
          notes: this.childData.notes && this.childData.notes.trim() !== '""' ? this.childData.notes : '',
          band_id: this.childData.band_id || ''
        }
      } else {
        // Add mode - reset form
        this.resetForm()
      }
    },

    resetForm() {
      this.formData = {
        name: '',
        age: '',
        schwimmer: 0,
        notes: '',
        band_id: ''
      }
    },

    validateForm() {
      const name = this.formData.name.trim()
      const age = this.formData.age
      const schwimmer = this.formData.schwimmer
      const bandId = this.formData.band_id

      if (!name) {
        this.showAlert('Bitte geben Sie einen Namen für das Kind ein.', 'warning')
        return false
      }

      if (!Number.isInteger(Number(age)) || Number(age) <= 0 || Number(age) > 99) {
        this.showAlert('Bitte geben Sie ein gültiges Alter (positive Zahl bis 99) ein.', 'warning')
        return false
      }

      if (!Number.isInteger(Number(schwimmer)) || Number(schwimmer) < 0 || Number(schwimmer) > 4) {
        this.showAlert('Bitte wählen Sie ein gültiges Schwimmer-Level (0 bis 4).', 'warning')
        return false
      }

      if (bandId && (isNaN(Number(bandId)) || !Number.isInteger(Number(bandId)) || Number(bandId) <= 0)) {
        this.showAlert('Armband Code muss eine positive Ganzzahl sein.', 'warning')
        return false
      }

      return true
    },

    async handleSubmit() {
      if (!this.validateForm()) {
        return
      }

      this.saving = true

      try {
        const childData = {
          name: this.formData.name.trim(),
          age: parseInt(this.formData.age),
          schwimmer: parseInt(this.formData.schwimmer),
          notes: this.formData.notes.trim(),
          group_id: this.groupId,
          band_id: this.formData.band_id ? String(this.formData.band_id) : null
        }

        if (this.isEditing) {
          childData.id = this.childData.id
        }

        const { data, message } = await this.saveChildToDb(childData)

        this.$emit('saved', data)
        this.showAlert(message, 'success')

        setTimeout(() => {
          this.closeModal()
        }, 1000)

      } catch (error) {
        this.showAlert(`Fehler beim Speichern: ${error.message}`, 'danger')
      } finally {
        this.saving = false
      }
    },

    closeModal() {
      this.resetForm()
      this.$emit('close')
    },

    showAlert(message, type = 'info') {
      const alertContainer = document.getElementById('modalAlertContainer')
      if (!alertContainer) return

      alertContainer.innerHTML = ''

      const alertDiv = document.createElement('div')
      alertDiv.className = `alert alert-${type} alert-dismissible fade show`
      alertDiv.role = 'alert'
      alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `
      alertContainer.appendChild(alertDiv)

      setTimeout(() => {
        alertDiv.remove()
      }, 5000)
    }
  }
}
</script>

<style scoped>
.modal {
  overflow-y: auto;
}

.modal-dialog {
  margin: 1.75rem auto;
}

.btn-close-white {
  filter: brightness(0) invert(1);
}

.form-label {
  font-weight: 500;
}

.form-control:focus,
.form-select:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

textarea.form-control {
  resize: vertical;
  min-height: 80px;
}
</style>