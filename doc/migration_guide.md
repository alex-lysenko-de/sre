<!-- Example: How to use the refactored architecture -->
<template>
  <div>
    <h1>Hello, {{ userStore.displayName }}</h1>
    
    <div v-if="userStore.needsCheckIn">
      <button @click="handleCheckIn">Check In</button>
    </div>
    
    <div v-if="loading">Loading...</div>
    <div v-if="error">Error: {{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useUser } from '@/composables/useUser'

// ============ NEW WAY (RECOMMENDED) ============

// Store for reactive state
const userStore = useUserStore()

// Composable for actions
const { loadUser, assignToGroup, assignToBus, logout } = useUser()

// Local state
const loading = ref(false)
const error = ref(null)

onMounted(async () => {
  loading.value = true
  try {
    await loadUser() // Loads with cache
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

const handleCheckIn = async () => {
  try {
    await assignToGroup(5)
    await assignToBus(3)
  } catch (err) {
    error.value = err.message
  }
}

// ============ OLD WAY (DEPRECATED) ============
/*
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(async () => {
  await userStore.loadUser() // ❌ Store method (old)
})

const handleCheckIn = async () => {
  await userStore.assignUserToGroup(5) // ❌ Store method (old)
  await userStore.assignUserToBus(3)    // ❌ Store method (old)
}
*/

</script>


# 🔄 Migration Checklist - User Store Refactoring

## ✅ Что было изменено

### **App.vue** - Основные изменения

#### ❌ СТАРЫЙ КОД (удалено):
```javascript
// Computed properties
const isAdmin = computed(() => userStore.isAdmin)
const isCheckInRequired = computed(() => userStore.isCheckInRequired)
const userEmail = computed(() => userStore.userEmail)

// Methods
await userStore.loadUser()
await userStore.loadUser(true) // Force reload
userStore.clearUserCache()
```

#### ✅ НОВЫЙ КОД (добавлено):
```javascript
// Import composable
import { useUser } from './composables/useUser'

// Use composable
const { loadUser, logout } = useUser()

// Direct access to store getters
userStore.isAdmin        // вместо isAdmin computed
userStore.needsCheckIn   // вместо isCheckInRequired
userStore.userEmail      // вместо userEmail computed

// Use composable methods
await loadUser()         // вместо userStore.loadUser()
await loadUser(true)     // force reload
await logout()           // вместо старой logout() функции
```

---

## 📋 Полный список изменений в App.vue

### 1. **Imports**
```javascript
// ✅ Добавлено
import { useUser } from './composables/useUser'
```

### 2. **Setup**
```javascript
// ✅ Добавлено
const { loadUser, logout } = useUser()

// ❌ Удалено
const isAdmin = computed(() => userStore.isAdmin)
const isCheckInRequired = computed(() => userStore.isCheckInRequired)
const userEmail = computed(() => userStore.userEmail)
```

### 3. **Template Changes**
```vue
<!-- ✅ Изменено -->
<div v-if="userStore.needsCheckIn" ...>
  <!-- Было: v-if="isCheckInRequired" -->

<li v-if="userStore.isAdmin" ...>
  <!-- Было: v-if="isAdmin" -->

<span>👤 {{ userStore.userEmail }}</span>
  <!-- Было: {{ userEmail }} -->
```

### 4. **Method Calls**
```javascript
// ✅ Изменено
await loadUser()
// Было: await userStore.loadUser()

await loadUser(true)
// Было: await userStore.loadUser(true)

await logout()
// Было: await supabase.auth.signOut() + manual cleanup
```

---

### Шаблон для обновления компонентов:

```vue
<script setup>
// ❌ СТАРЫЙ СПОСОБ
import { useUserStore } from '@/stores/user'
const userStore = useUserStore()

onMounted(async () => {
  await userStore.loadUser()
})

// ✅ НОВЫЙ СПОСОБ
import { useUserStore } from '@/stores/user'
import { useUser } from '@/composables/useUser'

const userStore = useUserStore()
const { loadUser, assignToGroup, assignToBus } = useUser()

onMounted(async () => {
  await loadUser()
})
```

---

## 🎯 Ключевые правила новой архитектуры

### ✅ DO (Правильно):
- ✅ Используйте **composable** для действий: `loadUser()`, `logout()`
- ✅ Используйте **store** для реактивных данных: `userStore.userInfo`, `userStore.isAdmin`
- ✅ Используйте **store getters** напрямую: `userStore.needsCheckIn`

### ❌ DON'T (Неправильно):
- ❌ Не вызывайте методы из store: `userStore.loadUser()`
- ❌ Не создавайте лишние computed: `computed(() => userStore.isAdmin)`
- ❌ Не используйте старые названия: `isCheckInRequired` → `needsCheckIn`



## 📦 Структура новой архитектуры

```
┌─────────────────────────────────────────┐
│         Components (UI Layer)           │
│  - App.vue                              │
│  - DailyCheckInModal.vue                │
│  - GroupChangeModal.vue                 │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│     Composables (Business Logic)        │
│  - useUser.js                           │
│    • loadUser()                         │
│    • assignToGroup()                    │
│    • logout()                           │
│    • Caching (5 min TTL)                │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Supabase Layer (Database Access)      │
│  - useSupabaseUser.js                   │
│    • fetchUserData()                    │
│    • updateUserSchedule()               │
│    • signOut()                          │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│         Store (State Only)              │
│  - stores/user.js                       │
│    • userInfo (reactive)                │
│    • Getters: isAdmin, needsCheckIn     │
│    • NO business logic                  │
└─────────────────────────────────────────┘
```

