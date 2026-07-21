# 🏗️ Architektur-Übersicht - AdminBusView System

## 📦 Komponenten-Hierarchie

```
AdminBusView.vue (Parent)
├── BusDetailModal.vue (Child)
└── ResetHistoryPanel.vue (Child)

Verwendet:
├── useBusData.js (Composable)
│   └── supabase (Client)
└── useConfigStore (Pinia Store)
    └── supabase (Client)
```

---

## 🗂️ Dateistruktur

```
src/
├── views/
│   └── AdminBusView.vue                # ~889 Zeilen (Stand 2026-07, war 450 bei Erstellung dieses Dokuments)
│       ├── Template: UI-Layout
│       ├── Script: Business Logic
│       └── Style: Component-Styling
│
├── components/
│   ├── BusDetailModal.vue              # 280 Zeilen
│   │   ├── Teleport für Modal
│   │   ├── Kinder-Liste
│   │   └── Betreuer-Liste
│   │
│   └── ResetHistoryPanel.vue           # 250 Zeilen
│       ├── Expandable Panel
│       ├── Event-Liste
│       └── Auto-Refresh
│
├── composables/
│   ├── useBusData.js                   # 350 Zeilen
│   │   ├── fetchBusData()
│   │   ├── fetchBusChildren()
│   │   ├── fetchBusBetreuer()
│   │   ├── startNewDay()
│   │   ├── softReset()
│   │   ├── closeDay()
│   │   └── getResetHistory()
│   │
│   ├── useUser.js                      # Existing
│   └── useSupabaseUser.js              # Existing
│
├── stores/
│   └── config.js                       # Existing (Pinia)
│       ├── totalBuses
│       ├── totalGroups
│       └── loadConfig()
│
└── router/
    └── index.js
        └── Route: /admin-busses
```

---

## 🔄 Datenfluss

### 1. Initial Load

```
User navigiert zu /admin-busses
         ↓
AdminBusView.vue mounted()
         ↓
configStore.loadConfig()  ← Lädt total_buses
         ↓
useBusData.fetchBusData(today)
         ↓
    ┌─────────────────┐
    │   Supabase DB   │
    ├─────────────────┤
    │ children_today  │ ← Kinder mit bus_now
    │ user_group_day  │ ← Betreuer mit bus_id
    │ users           │ ← Display Names
    └─────────────────┘
         ↓
Daten kombinieren & transformieren
         ↓
busesData.value = { 1: {...}, 2: {...}, 3: {...} }
         ↓
UI Re-Render (Reactive)
```

### 2. Bus-Detail öffnen

```
User klickt auf Bus-Nummer
         ↓
openBusDetail(busNumber)
         ↓
showBusModal = true
selectedBusNumber = busNumber
         ↓
BusDetailModal watch(show)
         ↓
loadBusDetails()
         ↓
    ┌──────────────────────────┐
    │ fetchBusChildren(bus)     │ ← Kinder-Details
    │ fetchBusBetreuer(bus)     │ ← Betreuer-Details
    └──────────────────────────┘
         ↓
Modal zeigt vollständige Listen
```

### 3. Tag starten (Reset)

```
User klickt "Tag starten"
         ↓
Confirm Dialog
         ↓
startDay()
         ↓
useBusData.startNewDay(today)
         ↓
getCurrentUser() ← Holt user.id
         ↓
INSERT INTO reset_events (day, user_id, event_type=1)
         ↓
    ┌─────────────────────────────┐
    │ Trigger: on_reset_event_insert │
    ├─────────────────────────────┤
    │ IF erste Reset des Tages:   │
    │   groups_today.children_today = children_now │
    │ ALWAYS:                      │
    │   children_today.presence_now = 0 │
    │   groups_today.children_now = 0  │
    └─────────────────────────────┘
         ↓
loadBusData() ← Neu laden
         ↓
UI Update mit neuen Werten
```

### 4. Auto-Refresh

```
setupAutoRefresh()
         ↓
setInterval(30000ms)
         ↓
loadBusData() (silent mode)
         ↓
fetchBusData(today)
         ↓
busesData.value aktualisiert
         ↓
UI Re-Render (automatisch)
```

---

## 🎯 Komponenten-Verantwortlichkeiten

### AdminBusView.vue

**Aufgaben:**
- Haupt-Layout verwalten
- Bus-Daten laden & anzeigen
- Reset-Aktionen koordinieren
- Auto-Refresh steuern
- Child-Komponenten orchestrieren

**Dependencies:**
- `useConfigStore` → totalBuses
- `useBusData` → Alle Bus-Operationen
- `BusDetailModal` → Detail-Ansicht
- `ResetHistoryPanel` → Event-Historie

**State:**
```javascript
{
  loading: Boolean,
  startingDay: Boolean,
  resetting: Boolean,
  showHeaderInfo: Boolean,
  lastUpdateTime: String,
  currentDate: String,
  error: String,
  success: String,
  busesData: Object,
  showBusModal: Boolean,
  selectedBusNumber: Number
}
```

**Computed:**
```javascript
{
  totalBusCount: Number,       // aus config
  totalChildren: Number,        // Summe
  totalBetreuer: Number,        // Summe
  activeBusesCount: Number,     // Mit Daten
  hasBusData: Boolean,
  totalBusRange: Array,         // [1,2,3,...]
  allBusesHaveData: Boolean     // Für grünen Status
}
```

**Methods:**
```javascript
{
  loadBusData(),
  startDay(),
  performSoftReset(),
  openBusDetail(busNumber),
  closeBusModal(),
  goBack(),
  setupAutoRefresh(),
  clearAutoRefresh()
}
```

---

### BusDetailModal.vue

**Aufgaben:**
- Detail-Informationen zu einem Bus
- Kinder-Liste anzeigen
- Betreuer-Liste anzeigen
- Refresh-Funktion

**Props:**
```javascript
{
  show: Boolean,          // Modal öffnen/schließen
  busNumber: Number       // Welcher Bus
}
```

**Emits:**
```javascript
{
  close: void            // Modal schließen
}
```

**State:**
```javascript
{
  loading: Boolean,
  busData: {
    kinder_count: Number,
    betreuer_count: Number
  },
  betreuerDetails: Array,
  childrenDetails: Array
}
```

**Methods:**
```javascript
{
  loadBusDetails(),      // Lädt Kinder + Betreuer
  close(),               // Emit close event
  refresh()              // Neu laden
}
```

---

### ResetHistoryPanel.vue

**Aufgaben:**
- Reset-Events anzeigen
- Event-Typen visualisieren
- Zeitstempel formatieren
- Auto-Refresh optional

**Props:**
```javascript
{
  date: String,          // YYYY-MM-DD
  autoRefresh: Boolean   // Auto-Update?
}
```

**State:**
```javascript
{
  loading: Boolean,
  isExpanded: Boolean,
  resetEvents: Array
}
```

**Methods:**
```javascript
{
  loadHistory(),
  togglePanel(),
  getEventTypeName(type),
  getEventIcon(type),
  getEventBadgeClass(type),
  formatTime(timestamp),
  setupAutoRefresh(),
  clearAutoRefresh()
}
```

---

## 🔌 Composables

### useBusData.js

**Zweck:** Zentrale Logik für alle Bus-Operationen

**Funktionen:**

#### Haupt-Funktionen
```javascript
fetchBusData(date)
// Returns: { busNumber: { kinder_count, betreuer_count, betreuer_names } }
// Kombiniert children_today + user_group_day_rows

fetchSingleBusData(busNumber, date)
// Returns: Bus-Daten für einen spezifischen Bus

fetchBusSummary(date)
// Returns: Erweiterte Statistiken mit Totals
```

#### Detail-Funktionen
```javascript
fetchBusChildren(busNumber)
// Returns: Array<{ id, name, age, schwimmer, group_id }>

fetchBusBetreuer(busNumber, date)
// Returns: Array<{ id, name, email, phone, group_id }>
```

#### Reset-Funktionen
```javascript
startNewDay(date)
// Creates: reset_events entry mit event_type = 1

softReset(date)
// Creates: reset_events entry mit event_type = 2

closeDay(date)
// Creates: reset_events entry mit event_type = 0

getResetHistory(date)
// Returns: Array<ResetEvent> für Datum
```

#### Utilities
```javascript
getCurrentUser()
// Returns: { id, user_id, email, display_name, role }
// Wichtig: Holt numerische id aus users Tabelle
```

---

## 🗄️ Datenbank-Interaktionen

### Queries (automatisch in useBusData.js)

#### 1. Bus-Daten laden

```sql
-- Kinder
SELECT bus_now, child_id
FROM children_today
WHERE bus_now IS NOT NULL
  AND presence_now > 0;

-- Betreuer
SELECT ugdr.bus_id, ugdr.group_id, u.id, u.display_name
FROM user_group_day_rows ugdr
JOIN users u ON ugdr.user_id = u.id
WHERE ugdr.day = :date
  AND ugdr.isPresentToday = 1
  AND ugdr.bus_id IS NOT NULL;
```

#### 2. Bus-Kinder-Details

```sql
SELECT 
  ct.child_id, ct.group_id, ct.bus_now, ct.presence_now,
  c.id, c.name, c.age, c.schwimmer, c.notes
FROM children_today ct
JOIN children c ON ct.child_id = c.id
WHERE ct.bus_now = :busNumber
  AND ct.presence_now > 0
ORDER BY c.name;
```

#### 3. Bus-Betreuer-Details

```sql
SELECT 
  ugdr.user_id, ugdr.group_id, ugdr.bus_id,
  u.id, u.display_name, u.email, u.phone
FROM user_group_day_rows ugdr
JOIN users u ON ugdr.user_id = u.id
WHERE ugdr.day = :date
  AND ugdr.bus_id = :busNumber
  AND ugdr.isPresentToday = 1
ORDER BY u.display_name;
```

#### 4. Reset erstellen

```sql
INSERT INTO reset_events (day, user_id, event_type)
VALUES (:date, :userId, :eventType)
RETURNING *;
```

#### 5. Reset-Historie laden

```sql
SELECT 
  re.id, re.created_at, re.day, re.event_type, re.user_id,
  u.id, u.display_name, u.email
FROM reset_events re
JOIN users u ON re.user_id = u.id
WHERE re.day = :date
ORDER BY re.created_at DESC;
```

---

## 🔒 Sicherheit & Permissions

### Row Level Security (RLS)

```sql
-- children_today: Jeder authentifizierte User kann lesen
CREATE POLICY "authenticated_read_children_today"
ON children_today FOR SELECT
TO authenticated
USING (true);

-- user_group_day_rows: Jeder authentifizierte User kann lesen
CREATE POLICY "authenticated_read_user_group_day"
ON user_group_day_rows FOR SELECT
TO authenticated
USING (true);

-- reset_events: Nur Admins können einfügen
CREATE POLICY "admin_insert_reset_events"
ON reset_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.user_id = auth.uid()
    AND users.role = 'admin'
  )
);

-- reset_events: Jeder kann lesen
CREATE POLICY "authenticated_read_reset_events"
ON reset_events FOR SELECT
TO authenticated
USING (true);
```

### Frontend-Checks

```javascript
// In AdminBusView.vue - nur für Admins zugänglich
// Via Router Meta:
{
  path: '/admin-busses',
  meta: { requiresAdmin: true }
}

// In Navigation Guard:
router.beforeEach((to, from, next) => {
  if (to.meta.requiresAdmin) {
    const userStore = useUserStore()
    if (userStore.user.role !== 'admin') {
      next('/unauthorized')
      return
    }
  }
  next()
})
```

---

## 🎨 Styling-System

### CSS-Architektur

```css
/* Scoped Styles pro Komponente */
AdminBusView.vue <style scoped>
BusDetailModal.vue <style scoped>
ResetHistoryPanel.vue <style scoped>

/* Global Styles (nur Bootstrap) */
- Bootstrap 5.3.3 via CDN
- Font Awesome 6.0 via CDN
```

### Design-Tokens

```css
/* Farben */
--primary: #007bff;
--success: #28a745;
--warning: #ffc107;
--danger: #dc3545;
--info: #17a2b8;

/* Gradients */
--gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--gradient-success: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);

/* Spacing */
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;
--spacing-xl: 2rem;

/* Border Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;

/* Transitions */
--transition-fast: 0.15s ease;
--transition-base: 0.3s ease;
--transition-slow: 0.5s ease;
```

---

## 🧩 State Management

### Lokaler State (Komponenten)

```javascript
// AdminBusView.vue
const busesData = ref({})           // Bus-Daten Cache
const loading = ref(false)          // Loading-Status
const error = ref(null)             // Error-Messages
const success = ref(null)           // Success-Messages

// BusDetailModal.vue
const betreuerDetails = ref([])     // Betreuer-Liste
const childrenDetails = ref([])     // Kinder-Liste

// ResetHistoryPanel.vue
const resetEvents = ref([])         // Event-Historie
const isExpanded = ref(false)       // Panel-Status
```

### Globaler State (Pinia)

```javascript
// useConfigStore
{
  totalBuses: 3,
  totalGroups: 10,
  year: 2025,
  // ... weitere Config-Werte
}

// useUserStore (existing)
{
  user: {
    id: 2,
    email: 'admin@example.com',
    role: 'admin',
    display_name: 'Max Admin'
  }
}
```

---

## 🔄 Lifecycle & Events

### AdminBusView.vue

```javascript
// MOUNTED
onMounted(async () => {
  // 1. Config laden
  if (!configStore.isConfigLoaded()) {
    await configStore.loadConfig()
  }
  
  // 2. Initial Daten laden
  await loadBusData()
  
  // 3. Header-Info ausblenden nach 3s
  setTimeout(() => { showHeaderInfo.value = false }, 3000)
  
  // 4. Auto-Refresh aktivieren
  setupAutoRefresh()
})

// UNMOUNTED
onUnmounted(() => {
  clearAutoRefresh()
})

// WATCH (keine aktiv)
```

### BusDetailModal.vue

```javascript
// WATCH
watch(() => props.show, (newVal) => {
  if (newVal) {
    loadBusDetails()  // Laden wenn Modal öffnet
  }
})
```

### ResetHistoryPanel.vue

```javascript
// MOUNTED
onMounted(() => {
  if (props.autoRefresh) {
    setupAutoRefresh()
  }
})

// WATCH
watch(() => props.date, () => {
  if (isExpanded.value) {
    loadHistory()  // Neu laden bei Datumswechsel
  }
})

watch(() => props.autoRefresh, (newVal) => {
  if (newVal) {
    setupAutoRefresh()
  } else {
    clearAutoRefresh()
  }
})
```

---

## 📡 API-Calls Übersicht

### GET Requests

| Funktion | Tabelle(n) | Zweck | Cache |
|----------|-----------|-------|-------|
| `fetchBusData()` | `children_today`, `user_group_day_rows`, `users` | Bus-Übersicht | 30s |
| `fetchBusChildren()` | `children_today`, `children` | Kinder-Liste | Nein |
| `fetchBusBetreuer()` | `user_group_day_rows`, `users` | Betreuer-Liste | Nein |
| `getResetHistory()` | `reset_events`, `users` | Event-Historie | Nein |
| `getCurrentUser()` | `users` | User-Info | Session |
| `loadConfig()` | `config` | App-Config | 5min |

### POST Requests

| Funktion        | Tabelle | Payload | Trigger |
|-----------------|---------|---------|---------|
| `startNewDay()` | `reset_events` | `{ day, user_id, event_type: 1 }` | ✅ |
| `softReset()`   | `reset_events` | `{ day, user_id, event_type: 2 }` | ✅ |
| `closeDay()`    | `reset_events` | `{ day, user_id, event_type: 0 }` | ✅ |

---

## 🎭 Error Handling

### Try-Catch Pattern

```javascript
// Standard Pattern in allen async Funktionen
async function loadBusData() {
  loading.value = true
  error.value = null
  
  try {
    const data = await fetchBusData(today)
    busesData.value = data
    success.value = 'Daten erfolgreich geladen!'
  } catch (err) {
    console.error('Fehler beim Laden:', err)
    error.value = 'Fehler beim Laden der Daten'
  } finally {
    loading.value = false
  }
}
```

### Error-Typen

```javascript
// Network Error
if (err.message.includes('Failed to fetch')) {
  error.value = 'Netzwerkfehler. Bitte Verbindung prüfen.'
}

// Auth Error
if (err.message.includes('not authenticated')) {
  error.value = 'Nicht angemeldet. Bitte neu einloggen.'
}

// Permission Error
if (err.message.includes('permission denied')) {
  error.value = 'Keine Berechtigung für diese Aktion.'
}

// Database Error
if (err.code?.startsWith('PGRST')) {
  error.value = 'Datenbankfehler. Support kontaktieren.'
}
```

### User Feedback

```vue
<!-- Alert-Container in AdminBusView -->
<div v-if="error" class="alert alert-danger">
  <i class="fas fa-exclamation-triangle me-2"></i>
  {{ error }}
  <button @click="error = null">×</button>
</div>

<div v-if="success" class="alert alert-success">
  <i class="fas fa-check-circle me-2"></i>
  {{ success }}
</div>
```

---

## 🔍 Performance-Optimierungen

### 1. Lazy Loading

```javascript
// Router lazy loading
{
  path: '/admin-busses',
  component: () => import('@/views/AdminBusView.vue')
}
```

### 2. Computed Caching

```javascript
// Wird nur neu berechnet wenn busesData sich ändert
const totalChildren = computed(() => {
  return Object.values(busesData.value)
    .reduce((sum, bus) => sum + (bus.kinder_count || 0), 0)
})
```

### 3. Debouncing

```javascript
// Bei häufigen Updates
import { debounce } from 'lodash-es'

const debouncedRefresh = debounce(() => {
  loadBusData()
}, 500)
```

### 4. Virtual Scrolling (für große Listen)

```vue
<!-- Falls >100 Kinder pro Bus -->
<RecycleScroller
  :items="childrenDetails"
  :item-size="50"
  key-field="id"
>
  <template #default="{ item }">
    <div class="child-item">{{ item.name }}</div>
  </template>
</RecycleScroller>
```

### 5. Index-Optimierung

```sql
-- Bereits in triggers.md erwähnt
CREATE INDEX idx_children_today_bus_presence 
  ON children_today(bus_now, presence_now)
  WHERE bus_now IS NOT NULL;

CREATE INDEX idx_user_group_day_bus_date
  ON user_group_day_rows(day, bus_id, isPresentToday)
  WHERE bus_id IS NOT NULL;
```

---

## 🧪 Testing-Strategie

### Unit Tests (Vitest)

```javascript
// useBusData.test.js
describe('useBusData', () => {
  it('should fetch bus data correctly', async () => {
    const { fetchBusData } = useBusData()
    const data = await fetchBusData('2025-10-19')
    
    expect(data).toHaveProperty('1')
    expect(data['1']).toHaveProperty('kinder_count')
    expect(data['1']).toHaveProperty('betreuer_count')
  })
  
  it('should create reset event', async () => {
    const { startNewDay } = useBusData()
    const result = await startNewDay('2025-10-19')
    
    expect(result).toHaveProperty('event_type', 1)
  })
})
```

### Component Tests (Vue Test Utils)

```javascript
// AdminBusView.test.js
import { mount } from '@vue/test-utils'
import AdminBusView from '@/views/AdminBusView.vue'

describe('AdminBusView', () => {
  it('renders bus table correctly', () => {
    const wrapper = mount(AdminBusView)
    expect(wrapper.find('.bus-table').exists()).toBe(true)
  })
  
  it('opens modal on bus click', async () => {
    const wrapper = mount(AdminBusView)
    await wrapper.find('.bus-number').trigger('click')
    expect(wrapper.vm.showBusModal).toBe(true)
  })
})
```

### E2E Tests (Playwright)

```javascript
// admin-bus-view.spec.js
test('Admin can start new day', async ({ page }) => {
  await page.goto('/admin-busses')
  await page.click('text=Tag starten')
  await page.click('text=OK')  // Confirm
  await expect(page.locator('.alert-success')).toBeVisible()
})

test('Bus detail modal works', async ({ page }) => {
  await page.goto('/admin-busses')
  await page.click('text=Bus 1')
  await expect(page.locator('.modal-title')).toContainText('Bus 1')
})
```

---

## 📊 Monitoring & Analytics

### Console-Logging

```javascript
// Development Mode
if (import.meta.env.DEV) {
  console.log('🚌 Bus Data:', busesData.value)
  console.log('👤 Current User:', currentUser)
  console.log('⏱️ Load Time:', Date.now() - startTime)
}
```

### Performance Tracking

```javascript
// In useBusData.js
async function fetchBusData(date) {
  const start = performance.now()
  
  try {
    // ... fetch logic
  } finally {
    const end = performance.now()
    console.log(`⚡ fetchBusData took ${end - start}ms`)
  }
}
```

### Error Tracking (Sentry)

```javascript
// main.js
import * as Sentry from '@sentry/vue'

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE
})
```

---

## 🔐 Security Best Practices

### 1. Input Validation

```javascript
// In useBusData.js
async function startNewDay(date) {
  // Validiere Datum-Format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Ungültiges Datumsformat')
  }
  
  // Verhindere zukünftige Daten
  if (new Date(date) > new Date()) {
    throw new Error('Datum darf nicht in der Zukunft liegen')
  }
  
  // ... rest
}
```

### 2. XSS-Schutz

```vue
<!-- Vue escapet automatisch, aber bei v-html aufpassen -->
<div v-html="sanitizeHTML(userInput)"></div>

<script>
import DOMPurify from 'dompurify'

function sanitizeHTML(html) {
  return DOMPurify.sanitize(html)
}
</script>
```

### 3. CSRF-Schutz

```javascript
// Supabase handhabt das automatisch via JWT
// Keine zusätzliche Action nötig
```

### 4. Rate Limiting

```javascript
// In useBusData.js
const rateLimiter = {
  lastCall: 0,
  minInterval: 1000 // 1 Sekunde
}

async function startNewDay(date) {
  const now = Date.now()
  if (now - rateLimiter.lastCall < rateLimiter.minInterval) {
    throw new Error('Zu viele Anfragen. Bitte warten.')
  }
  rateLimiter.lastCall = now
  
  // ... rest
}
```

---

## 📱 Progressive Web App (PWA)

### Service Worker

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa'

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Stadtranderholung Bus-Verwaltung',
        short_name: 'Bus Admin',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
}
```

### Offline-Modus

```javascript
// In useBusData.js
async function fetchBusData(date) {
  try {
    const data = await supabase...
    
    // Cache für Offline
    localStorage.setItem(`bus_data_${date}`, JSON.stringify(data))
    
    return data
  } catch (err) {
    // Fallback auf Cache
    if (!navigator.onLine) {
      const cached = localStorage.getItem(`bus_data_${date}`)
      if (cached) return JSON.parse(cached)
    }
    throw err
  }
}
```

---

## 🌐 Internationalisierung (i18n)

### Setup (optional)

```javascript
// i18n.js
import { createI18n } from 'vue-i18n'

const messages = {
  de: {
    bus: {
      title: 'Bus-Übersicht',
      children: 'Kinder',
      betreuer: 'Betreuer',
      startDay: 'Tag starten',
      softReset: 'Soft Reset'
    }
  },
  en: {
    bus: {
      title: 'Bus Overview',
      children: 'Children',
      betreuer: 'Supervisors',
      startDay: 'Start Day',
      softReset: 'Soft Reset'
    }
  }
}

export default createI18n({
  locale: 'de',
  messages
})
```

### Verwendung

```vue
<template>
  <h2>{{ $t('bus.title') }}</h2>
  <button>{{ $t('bus.startDay') }}</button>
</template>
```

---

## 🔮 Zukunfts-Features

### 1. Realtime Updates (WebSocket)

```javascript
// In AdminBusView.vue
import { supabase } from '@/supabase'

onMounted(() => {
  const channel = supabase
    .channel('bus-updates')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'children_today' },
      (payload) => {
        console.log('🔄 Realtime Update:', payload)
        loadBusData()
      }
    )
    .subscribe()
})
```

### 2. Export-Funktion

```javascript
// Export zu Excel
import * as XLSX from 'xlsx'

function exportToExcel() {
  const data = Object.entries(busesData.value).map(([bus, data]) => ({
    Bus: bus,
    Kinder: data.kinder_count,
    Betreuer: data.betreuer_count,
    Namen: data.betreuer_names.join(', ')
  }))
  
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Busse')
  XLSX.writeFile(wb, `bus-uebersicht-${new Date().toISOString().split('T')[0]}.xlsx`)
}
```

### 3. PDF-Report

```javascript
// Mit jsPDF
import jsPDF from 'jspdf'
import 'jspdf-autotable'

function generatePDF() {
  const doc = new jsPDF()
  
  doc.text('Bus-Übersicht', 14, 20)
  doc.text(`Datum: ${formattedCurrentDate.value}`, 14, 30)
  
  const tableData = Object.entries(busesData.value).map(([bus, data]) => [
    bus,
    data.kinder_count,
    data.betreuer_count,
    data.betreuer_names.join(', ')
  ])
  
  doc.autoTable({
    head: [['Bus', 'Kinder', 'Betreuer', 'Namen']],
    body: tableData,
    startY: 40
  })
  
  doc.save(`bus-report-${new Date().toISOString().split('T')[0]}.pdf`)
}
```

### 4. Push-Benachrichtigungen

```javascript
// Service Worker Notification
if ('Notification' in window && 'serviceWorker' in navigator) {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('Alle Busse erfasst!', {
          body: 'Bereit für die Abfahrt',
          icon: '/icon-192.png'
        })
      })
    }
  })
}
```

### 5. Dashboard-Widget

```vue
<!-- BusDashboardWidget.vue - Kompakte Ansicht für Dashboard -->
<template>
  <div class="bus-widget">
    <div class="widget-header">
      <h6>Bus-Status</h6>
      <router-link to="/admin-busses">Details →</router-link>
    </div>
    <div class="widget-body">
      <div class="stat">
        <span class="number">{{ totalChildren }}</span>
        <span class="label">Kinder</span>
      </div>
      <div class="stat">
        <span class="number">{{ totalBetreuer }}</span>
        <span class="label">Betreuer</span>
      </div>
      <div class="stat">
        <span class="number">{{ activeBusesCount }}/{{ totalBusCount }}</span>
        <span class="label">Busse</span>
      </div>
    </div>
  </div>
</template>
```

---

## 📚 Zusammenfassung

### Kern-Komponenten
- ✅ **AdminBusView.vue** - Haupt-Übersicht
- ✅ **BusDetailModal.vue** - Detail-Ansicht
- ✅ **ResetHistoryPanel.vue** - Event-Historie

### Kern-Logik
- ✅ **useBusData.js** - Alle Bus-Operationen
- ✅ **useConfigStore** - Konfiguration
- ✅ **Trigger** - Automatische DB-Updates

### Features
- ✅ Realtime Bus-Übersicht
- ✅ Kinder/Betreuer-Zählung
- ✅ Tag-Management (Start/Reset)
- ✅ Detail-Ansichten
- ✅ Event-Historie
- ✅ Auto-Refresh
- ✅ Mobile-Responsive

### Nächste Schritte
- 🔄 WebSocket-Integration
- 📊 Export-Funktionen
- 📄 PDF-Reports
- 🔔 Push-Notifications
- 📱 PWA-Optimierung

---

## 🎓 Best Practices Checkliste

- [x] Komponenten sind modular und wiederverwendbar
- [x] Composables folgen Single-Responsibility-Prinzip
- [x] Error-Handling überall implementiert
- [x] Loading-States für User-Feedback
- [x] Responsive Design (Mobile-First)
- [x] Accessibility (ARIA-Labels wo nötig)
- [x] Performance-Optimierungen (Computed, Debounce)
- [x] Security (RLS, Input-Validation)
- [x] Code-Dokumentation (JSDoc)
- [x] TypeScript-ready (Type-Hints in Comments)

---

**🎉 System ist produktionsbereit!**