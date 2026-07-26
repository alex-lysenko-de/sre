// src/composables/useScannerFeedback.js
// Technische Primitiven fuer Ton/Vibration im Scanner-Prototyp (Ticket 116).
// Kennt keine Presets ("Erfolg"/"Fehler") - die aufrufende Seite entscheidet,
// welche Frequenzen/Muster fuer welchen Fall stehen.

export function useScannerFeedback() {
    let audioContext = null

    const getAudioContext = () => {
        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext
            audioContext = new AudioContextClass()
        }
        return audioContext
    }

    // An den ersten click/touchend im Dokument binden, damit der AudioContext
    // innerhalb einer echten Nutzergeste erstellt/resumiert wird - Voraussetzung
    // fuer hoerbaren Ton auf iOS Safari.
    const unlockAudioContext = () => {
        const ctx = getAudioContext()
        if (ctx.state === 'suspended') {
            ctx.resume()
        }
    }

    const playTone = (frequencies, toneDuration) => {
        const ctx = getAudioContext()
        if (ctx.state === 'suspended') {
            ctx.resume()
        }
        const now = ctx.currentTime
        frequencies.forEach((freq, index) => {
            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()
            oscillator.type = 'sine'
            oscillator.frequency.value = freq
            const startTime = now + index * toneDuration
            gainNode.gain.setValueAtTime(0.9, startTime)
            gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + toneDuration)
            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)
            oscillator.start(startTime)
            oscillator.stop(startTime + toneDuration)
        })
    }

    const vibrate = (pattern) => {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern)
            }
        } catch (error) {
            console.warn('Vibration nicht unterstützt:', error)
        }
    }

    const closeAudioContext = () => {
        audioContext?.close()
        audioContext = null
    }

    return {
        getAudioContext,
        unlockAudioContext,
        playTone,
        vibrate,
        closeAudioContext
    }
}
