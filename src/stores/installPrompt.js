import { defineStore } from 'pinia'
import { markRaw } from 'vue'

export const useInstallPromptStore = defineStore('installPrompt', {
    state: () => ({
        deferredPrompt: null,
        platform: 'other', // 'android' | 'ios' | 'other'
        isStandalone: false,
        bannerTriggered: false,
        showIosInstructions: false
    }),

    getters: {
        canInstall: (state) => {
            if (state.isStandalone) return false
            if (state.platform === 'android') return !!state.deferredPrompt
            return state.platform === 'ios'
        },
        showButton() {
            return this.canInstall && this.bannerTriggered
        }
    },

    actions: {
        init() {
            const userAgent = window.navigator.userAgent || ''
            const isIos = /iphone|ipad|ipod/i.test(userAgent)

            this.isStandalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                ('standalone' in window.navigator && window.navigator.standalone === true)

            if (isIos) {
                this.platform = 'ios'
            } else if ('onbeforeinstallprompt' in window) {
                this.platform = 'android'
            } else {
                this.platform = 'other'
            }

            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault()
                this.deferredPrompt = markRaw(e)
                this.platform = 'android'
            })

            window.addEventListener('appinstalled', () => {
                this.deferredPrompt = null
                this.isStandalone = true
            })
        },

        triggerBanner() {
            this.bannerTriggered = true
        },

        async promptInstall() {
            if (this.platform === 'android' && this.deferredPrompt) {
                await this.deferredPrompt.prompt()
                await this.deferredPrompt.userChoice
                this.deferredPrompt = null
            } else if (this.platform === 'ios') {
                this.showIosInstructions = true
            }
        },

        closeIosInstructions() {
            this.showIosInstructions = false
        }
    }
})
