// --- Static data for display ---
const SWIM_LEVELS = {
    0: 'Nichtschwimmer',
    1: 'Seepferdchen',
    2: 'Bronze',
    3: 'Silber',
    4: 'Gold',
}
const SWIM_BADGE_CLASSES = {
    0: 'bg-danger text-white',
    1: 'bg-warning text-dark',
    2: 'bg-secondary text-warning',
    3: 'bg-light text-secondary',
    4: 'bg-dark text-warning',
}

const Utils = {
    getSwimLevel(level) {
        return SWIM_LEVELS[level] || 'Unbekannt'
    },
    getSwimBadgeClass(level) {
        return SWIM_BADGE_CLASSES[level] || 'bg-light text-dark'
    },

    getCurrentDateString() {
        return new Date().toISOString().split('T')[0]
    },
    formatDateForDisplay(dateString) {
        const date = new Date(dateString)
        return date.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    },
    showAlert(message, type = 'info', containerId = 'alertContainer') {
        const alertContainer = document.getElementById(containerId)
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
    },
}

export { SWIM_LEVELS, SWIM_BADGE_CLASSES }

export default Utils