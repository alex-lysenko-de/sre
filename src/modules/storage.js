// src/modules/storage.js
// Persistente Speicherung von Auth-Daten via LocalForage (IndexedDB mit Fallback)
import localforage from 'localforage'

export const authLocalForage = localforage.createInstance({
    name: 'sre-app',
    storeName: 'auth'
})

/**
 * Liest einen Wert aus LocalForage, mit Read-through-Migration aus localStorage
 * (für Nutzer, die die Auth-Daten noch im alten localStorage haben)
 */
async function readThrough(key) {
    const value = await authLocalForage.getItem(key)
    if (value !== null && value !== undefined) return value

    const legacyValue = window.localStorage.getItem(key)
    if (legacyValue === null) return null

    await authLocalForage.setItem(key, legacyValue)
    window.localStorage.removeItem(key)
    return legacyValue
}

export async function getAuthItem(key) {
    return await readThrough(key)
}

export async function setAuthItem(key, value) {
    await authLocalForage.setItem(key, value)
}

export async function removeAuthItem(key) {
    await authLocalForage.removeItem(key)
    window.localStorage.removeItem(key)
}

/**
 * Storage-Adapter für supabase-js createClient({ auth: { storage } })
 * Key-agnostischer Passthrough zu LocalForage mit Read-through-Migration
 */
export const supabaseStorageAdapter = {
    getItem: (key) => readThrough(key),
    setItem: (key, value) => setAuthItem(key, value),
    removeItem: (key) => removeAuthItem(key)
}
