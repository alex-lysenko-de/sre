<template>
  <div class="container py-4">
    <!-- Summary Section -->
    <div class="card mb-4 shadow-sm">
      <div class="card-body text-center">
        <h4>Kinderübersicht</h4>
        <div class="row mt-3">
          <div class="col-md-6">
            <h5>Am Morgen</h5>
            <div class="display-6 text-primary">{{ totalMorning }}</div>
          </div>
          <div class="col-md-6">
            <h5>Aktuell</h5>
            <div class="display-6 text-success">{{ totalCurrent }}</div>
          </div>
        </div>
        <div v-if="missingGroups.length" class="alert alert-warning mt-3">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Achtung! {{ totalMissing }} Kind(er) fehlen in {{ missingGroups.length }} Gruppe(n)
        </div>
      </div>
    </div>

    <!-- Groups Table -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h5>
          <font-awesome-icon :icon="['fas', 'users']" class="me-2" />
          Gruppenübersicht
          <span class="badge bg-secondary ms-2">{{ groups.length }} aktiv</span>
        </h5>

        <div class="table-responsive mt-3">
          <table class="table table-hover align-middle">
            <thead class="table-light">
            <tr>
              <th>Status</th>
              <th>Gruppe</th>
              <th>Morgen</th>
              <th>Aktuell</th>
              <th>Betreuer</th>
              <th>Differenz</th>
              <th>Aktualisiert</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="group in groups" :key="group.id">
              <td v-html="getStatusIndicator(group)"></td>
              <td><strong>{{ group.name }}</strong></td>
              <td>{{ group.morning }}</td>
              <td>{{ group.current }}</td>
              <td>{{ group.betreuer.join(', ') }}</td>
              <td v-html="formatDifference(group)"></td>
              <td>{{ group.timestamp }}</td>
            </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// This component uses synthetic data for 15 groups with 10 members each.
// Interface language: German
// Code comments: English

export default {
  name: "AdminGroupView",
  data() {
    return {
      groups: [], // synthetic groups
    };
  },
  computed: {
    totalMorning() {
      return this.groups.reduce((sum, g) => sum + g.morning, 0);
    },
    totalCurrent() {
      return this.groups.reduce((sum, g) => sum + g.current, 0);
    },
    missingGroups() {
      return this.groups.filter((g) => g.morning > g.current);
    },
    totalMissing() {
      return this.missingGroups.reduce((sum, g) => sum + (g.morning - g.current), 0);
    },
  },
  methods: {
    // Generates synthetic data for 15 groups
    generateSyntheticData() {
      const names = ["Anna", "Max", "Lisa", "Paul", "Sophie", "Jonas", "Lena", "Tim", "Marie", "Felix"];
      for (let i = 1; i <= 15; i++) {
        const missing = Math.floor(Math.random() * 3); // 0–2 missing
        const current = 10 - missing;
        this.groups.push({
          id: i,
          name: `Gruppe ${i}`,
          morning: 10,
          current,
          betreuer: [
            names[Math.floor(Math.random() * names.length)],
            names[Math.floor(Math.random() * names.length)],
          ],
          timestamp: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        });
      }
    },

    // Returns a colored status indicator depending on group condition
    getStatusIndicator(group) {
      const diff = group.morning - group.current;
      if (diff === 0)
        return '<span class="text-success"><i class="fas fa-check-circle"></i></span>';
      else if (diff > 0)
        return '<span class="text-danger"><i class="fas fa-exclamation-circle"></i></span>';
      else
        return '<span class="text-info"><i class="fas fa-plus-circle"></i></span>';
    },

    // Formats difference between morning and current counts
    formatDifference(group) {
      const diff = group.morning - group.current;
      if (diff === 0)
        return '<span class="text-success">Komplett</span>';
      if (diff > 0)
        return `<span class="text-danger">-${diff}</span>`;
      return `<span class="text-info">+${Math.abs(diff)}</span>`;
    },
  },
  mounted() {
    this.generateSyntheticData();
  },
};
</script>

<style scoped>
.table th,
.table td {
  text-align: center;
}

.card {
  border-radius: 1rem;
}

.alert {
  border-radius: 1rem;
}

.table-hover tbody tr:hover {
  background-color: rgba(0, 123, 255, 0.05);
}
</style>
