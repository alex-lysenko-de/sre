// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/main.css'; // Tailwind CSS

const app = createApp(App);

app.use(router);

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err);
  console.error('Component:', instance);
  console.error('Error info:', info);
};

// Global warning handler
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Global warning:', msg);
  console.warn('Component:', instance);
  console.warn('Trace:', trace);
};

app.mount('#app');

// Register PWA update handler
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('New service worker activated');
  });
}