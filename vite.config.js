import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// IMPORTANT: Replace 'your-repo-name' with your actual GitHub repository name
// Example: if your repo URL is https://github.com/username/stadtranderholung
// then use: base: '/stadtranderholung/'
export default defineConfig({
    // Set base path for GitHub Pages
    // For custom domain: base: '/'
    // For GitHub Pages: base: '/your-repo-name/'
    base: process.env.NODE_ENV === 'production' ? '/sre/' : '/',
    
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
            workbox: {
                // Ensure all assets are cached for offline functionality
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                runtimeCaching: [
                    {
                        // Cache API calls to Supabase
                        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 5 * 60, // 5 minutes
                            },
                            networkTimeoutSeconds: 10,
                        },
                    },
                ],
            },
            manifest: {
                name: 'Stadtranderholung',
                short_name: 'Stadtrand',
                description: 'Organisation der Kinderfreizeit - PWA App',
                theme_color: '#198754',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                scope: '/sre/',
                start_url: '/sre/',
                icons: [
                    {
                        src: 'icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
