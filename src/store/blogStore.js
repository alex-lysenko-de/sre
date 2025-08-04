// src/store/blogStore.js
import { reactive, watch } from 'vue';

const STORAGE_KEY = 'blog-posts';

const initialPosts = [
  { 
    id: 1, 
    title: 'Teilprüfung2. Aufgabe', 
    content: 'Entwickle eine einfache Vue.js-Anwendung, die einen Blog darstellt. Die Anwendung sollte die folgenden Funktionen haben:\na) Erstelle eine Vue.js 3-Anwendung und binde die Daten für den Blog-Post-Titel und den Inhalt an Formularelemente auf der Seite.\nb) Füge eine Liste von Blog-Posts hinzu, die als Array von Objekten in deinen Daten gespeichert sind. Jedes Objekt sollte Eigenschaften für den Titel und den Inhalt des Posts haben.\nc) Implementiere eine Suchfunktion, die es ermöglicht, die Liste der Blog-Posts nach Titel zu durchsuchen. Verwende das v-model-Direktiv, um die Eingabe des Suchformulars an eine Datenvariable zu binden und die Liste der Posts entsprechend zu filtern.\nd) Füge die Möglichkeit hinzu, neue Blog-Posts über ein Formular hinzuzufügen. Verwende v-model, um die Eingaben des Formulars an Datenvariablen zu binden und füge den neuen Post beim Absenden des Formulars zur Liste hinzu.\ne) Implementiere bedingtes Rendering mit v-if und v-show, um nur die Blog-Posts anzuzeigen, die den Suchkriterien entsprechen.\nf) Füge Routing zu deiner Anwendung hinzu, so dass du zwischen einer Übersichtsseite und einer Detailseite für jeden Blog-Post wechseln kannst.\ng) Implementiere dynamisches Routing mit Parametern, so dass die Detailseite für jeden Blog-Post basierend auf seiner ID geladen wird.' 
	
  },
  { 
    id: 2, 
    title: 'Teilprüfung2. Hinweise zur Abgabeform', 
    content: 'Start: Jede Teilprüfungsleistung sollte mit der Installation eines neuen Projekts beginnen. Wie man ein neues Projekt installiert, kann den Verweisen entnommen werden. Bitte achte darauf, dass deine Entwicklungsumgebung korrekt eingerichtet ist.\nAchtung: Benenne dein Projekt als vue-tpl-[nr]-[vorname]-[nachname] und stelle sicher, dass du das gesamte Projekt als .zip-Datei komprimierst und über das Prüfungsportal hochlädst. Zum Beispiel: vue-tpl-1-john-doe.\nVerweise:\nTheorieskript: 4. Vue-Projekte aufsetzen\nKursinformationen: Anleitung Programmiertool\nDokumentation: Quick Start with Vue' 
  },
  { 
    id: 3, 
    title: 'Lorem Ipsum', 
    content: 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.' 
  }
];

// Versuch, Beiträge aus dem Local Storage zu laden
const storedPosts = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');

export const blogStore = reactive({
  posts: storedPosts && storedPosts.length > 0 ? storedPosts : initialPosts,

  /**
   * Berechnet die nächste verfügbare ID für einen neuen Beitrag.
   * @returns {number} Neue ID.
   */
  getNextId() {
    if (this.posts.length === 0) {
      return 1;
    }
    // Findet die maximale ID unter den vorhandenen Beiträgen und addiert 1
    const maxId = Math.max(...this.posts.map(post => post.id));
    return maxId + 1;
  },

  /**
   * Fügt einen neuen Beitrag zum Store hinzu.
   * @param {object} newPost - Neues Beitragsobjekt ohne ID.
   */
  addPost(newPost) {
    // Generiert eine neue ID mit getNextId
    const postId = this.getNextId();
    const postWithId = { ...newPost, id: postId };
    this.posts.unshift(postWithId); // Fügt am Anfang der Liste hinzu
  },

  /**
   * Findet einen Beitrag anhand seiner ID.
   * @param {string|number} id - ID des gesuchten Beitrags.
   * @returns {object|undefined} Gefundener Beitrag oder undefined.
   */
  findPostById(id) {
    return this.posts.find(post => post.id === parseInt(id));
  },

  /**
   * Speichert die aktuelle Beitragsliste im Local Storage.
   */
  savePostsToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.posts));
  },

  /**
   * Leert den Local Storage und setzt die Beiträge auf den Ausgangszustand zurück.
   */
  clearLocalStorage() {
    localStorage.removeItem(STORAGE_KEY);
    // Setzt das Beitragsarray auf den Ausgangszustand zurück und behält die Reaktivität bei.
    this.posts.splice(0, this.posts.length, ...initialPosts);
  }
});

// Automatisches Speichern bei Änderungen an `posts`
watch(() => blogStore.posts, () => {
  blogStore.savePostsToLocalStorage();
}, { deep: true });