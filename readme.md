# 🌳 Stadtranderholung App

Ein webbasiertes System zur **Sicherheitsüberwachung von Kindergruppen während Ausflügen und Ferienprogrammen**.

---

## 📘 Beschreibung

Diese Anwendung unterstützt **Betreuer:innen** und **Leitungspersonal** bei der Organisation und Überwachung von Kindergruppen – insbesondere bei der An- und Abreise mit dem Bus.  
Durch tägliche Check-ins wird sichergestellt, dass **alle Kinder erfasst und sicher begleitet** werden.

---

## 👥 Zielgruppe

- **Betreuer:innen** – verantwortlich für je ca. 10 Kinder  
- **Leitungspersonal (Admins)** – mit Gesamtübersicht und Konfigurationsrechten  

---

## 🛠️ Technologie-Stack

| Komponente | Beschreibung |
|-------------|---------------|
| **Framework** | Vue.js 3 (Composition API) |
| **Styling** | Bootstrap 5 + Font Awesome |
| **Backend** | Supabase (Edge Functions) |
| **App-Typ** | Progressive Web App (PWA) |
| **Design-Prinzip** | Responsive (Mobile-first) |
| **Build Tool** | Vite |
| **Package Manager** | npm (Node.js 20+) |
| **Hosting** | GitHub Pages |

---

## ⚙️ Entwicklungsrichtlinien

### REQUIREMENTS
- UI Language: **German (Deutsch)**  
- Comment & Debug Language: **English**  
- **NO Russian words** anywhere in code, comments, or UI text  
- Encoding: **UTF-8**  
- Indentation: **2 spaces**

### ARCHITECTURE & DESIGN
- Use **Composables** to isolate data logic (e.g. Supabase operations)  
- Keep **minimal coupling** to Supabase — prefer modular APIs and wrappers  
- Plan for **migration to Pinia** (state management)  
- Use a global **config module** for environment and runtime settings  
- Maintain **clear separation** between UI, logic, and data layers  

### RULES
- All visible UI text → **German**  
- All comments, logs, debug messages → **English**  
- Follow **ESLint + Prettier** formatting rules  
- Keep **responsive, mobile-first** layout  
- Use **@ alias** for imports  
- NEVER hardcode **secrets or credentials**  
- Minimize **network requests** and use caching where possible  
- Consistent naming conventions → camelCase / PascalCase  

---

## 🚀 Setup & Entwicklung

### 1️⃣ Installation
```bash
npm install
````

### 2️⃣ Entwicklung starten

```bash
npm run dev
```

### 3️⃣ Produktion builden

```bash
npm run build
```

### 4️⃣ Deployment (automatisch via GitHub Actions)

Push auf den Branch **main** → Deployment auf GitHub Pages

---

## 📦 Projektstruktur (Kurzüberblick)

```
src/
 ├─ components/       → Reusable Vue components
 ├─ composables/      → Logic modules (e.g. Supabase integration)
 ├─ modules/          → Config, helpers, global utilities
 ├─ views/            → Main views and pages
 ├─ router/           → Vue Router configuration
 ├─ assets/           → Static resources
 ├─ supabase/         → Edge Functions (Deno / TypeScript)
```

---

## 🧭 Entwicklungsphilosophie

* **Minimalism & Clarity:** Less code, more clarity.
* **Consistency:** Einheitliche Struktur, Sprache und Formatierung.
* **Scalability:** Architektur vorbereitet für Pinia und zukünftige API-Erweiterungen.
* **Maintainability:** Trennung von Logik, UI und Datenzugriff für langfristige Wartbarkeit.
