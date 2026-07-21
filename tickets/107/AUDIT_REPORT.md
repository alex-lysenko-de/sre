# Ticket 107 — Aufräumen der Projektdateien: Audit-Bericht

Umfang: alle losen Dateien im Projekt-Root (`readme.md`, `backup.bat`, `pack.bat`, `unpack.bat`, `project_packer.py`, `backup.sql`) sowie sämtliche Dateien unter `doc/` (inkl. `doc/db/` und `doc/utils/`).

**Wichtiger Hinweis zur Vorgehensweise:** Auf ausdrücklichen Wunsch wurden in diesem Durchgang **keine Dateien gelöscht**. Für Dateien, die inhaltlich als überholt/redundant eingestuft wurden, steht unten **„LÖSCHEN (empfohlen, nicht ausgeführt)"** — die Datei existiert weiterhin unverändert im Repo, die Entscheidung über das tatsächliche Löschen liegt beim Projektinhaber.

---

## ⚠️ Sicherheitsfund (unabhängig vom eigentlichen Auftrag)

Bei der Durchsicht wurde ein **echter Supabase `service_role`-Key im Klartext** in zwei versionierten Dateien gefunden:
- `doc/sb_install_keys.bat`
- `doc/supabase_install.md`

Dieser Key hebelt Row Level Security vollständig aus. Er wurde im Commit `7fd4c5a "new technology"` eingecheckt, **dieser Commit befindet sich bereits auf `origin/main`** (github.com/alex-lysenko-de/sre.git). Zusätzlich enthält `doc/users.sql` eine echte Bootstrap-Admin-E-Mail, Telefonnummer und ein Klartext-Passwort (`P@ssw0rd123`).

**Auf ausdrücklichen Wunsch des Projektinhabers wurden diese drei Dateien in diesem Durchgang nicht verändert** — der Key wird bewusst nicht rotiert/entfernt. Dieser Punkt wird hier nur zur Dokumentation festgehalten.

---

## Root-Verzeichnis

| Datei | Inhalt | Entscheidung |
|---|---|---|
| `readme.md` | Tech-Stack, Architektur- und Coding-Regeln, Setup-Anleitung | **BEHALTEN** — stimmt mit `package.json` und der aktuellen Projektstruktur überein |
| `backup.bat` | `supabase db dump` mit bewusst generischem Passwort-Platzhalter | **BEHALTEN** — Platzhalter ist Absicht (kein Secret im Klartext), Nutzer trägt Passwort manuell ein |
| `backup.sql` (0 Bytes) | Leere Artefakt-Datei, vermutlich Output-Datei von `backup.bat` | **LÖSCHEN (empfohlen, nicht ausgeführt)** — leer, kein Informationswert, wird bei Bedarf neu erzeugt |
| `pack.bat` / `unpack.bat` | Rufen `project_packer.py` auf, um `src/` in eine einzelne Markdown-Datei zu bündeln (z.B. für externe LLM-Tools) | **AKTUALISIERT** — siehe unten |
| `project_packer.py` | Pack/Unpack-Logik für obige Skripte | **AKTUALISIERT (Bugfix)** — Datei war am Ende abgeschnitten (`el` statt `elif ...`), dadurch schlug **sowohl `pack.bat` als auch `unpack.bat` mit `SyntaxError`** fehl. Fehlender `elif args.mode == "unpack"`-Zweig wurde ergänzt und die Syntax verifiziert (`ast.parse` erfolgreich). *Hinweis:* Da Claude Code in diesem Projekt bereits direkten Dateizugriff hat, ist der praktische Nutzen dieses Tools inzwischen gering — Empfehlung, es bei Gelegenheit ganz zu entfernen, falls es nicht mehr für andere (Nicht-Claude-Code) AI-Tools gebraucht wird. |

---

## `doc/` — Tech-Task-Dokumente

| Datei | Inhalt | Abgleich mit Code | Entscheidung |
|---|---|---|---|
| `AdminBusView_TechTask.md` | Aktuelle Bus-/Kinderzähl-Logik hinter AdminBusView | Stimmt exakt mit `useBusData.js` überein | **BEHALTEN** |
| `ArmbandTask.md` | Spezifikation Armband→Kind-Zuordnung | Kernlogik korrekt, aber referenzierte `useAuth.js`/`stores/children.js`/`ArmbandAssignForm.vue` existieren nicht | **AKTUALISIERT** — auf reale Struktur (`useArmband.js`, `stores/user.js`, `ArmbandConnectView.vue`) korrigiert, Status-Vermerk ergänzt |
| `Aufgabe.md` | Ursprüngliche Gesamtspezifikation für `useUser`/`selectGroupAndBus` | Beschreibt ein abweichendes, nie umgesetztes Schema (`status`-Feld unsicher dokumentiert); inhaltlich durch `useUser.md` + `selectGroupAndBus.md` abgedeckt | **LÖSCHEN (empfohlen, nicht ausgeführt)** — Duplikat einer überholten Zwischenversion |
| `ChildrenView_TechTask.md` | Auftrag, Mock-/Zufallsdaten in ChildrenView durch echte Queries zu ersetzen | Vollständig umgesetzt (`useGroups.js`, keine `Math.random()`-Reste mehr) | **LÖSCHEN (empfohlen, nicht ausgeführt)** — beschriebenes Problem existiert nicht mehr |
| `QR-codes.md` | Aktuelles QR-URL-Format (`?id=`/`?n=`) + Vorschlag für künftiges Format | Übereinstimmung mit Router-Logik und `qr-gen.html`-Tools bestätigt | **BEHALTEN** |
| `selectGroupAndBus.md` | Spezifikation für tägliches Check-in-Modal | Größtenteils umgesetzt als `DailyCheckInModalView.vue` + `GroupChangeModal.vue`/`BusChangeModal.vue` (andere Namen als im Doc) | **AKTUALISIERT** — Status-Vermerk mit realer Komponentenzuordnung ergänzt |
| `tickets.md` | Früher Backlog-Plan (ScanView, BindBraceletView, verschachtelte `/main`-Routen, Tabelle `c_bands`) | Keine dieser Komponenten/Tabellen existiert; MainView ist eine flache Route, kein verschachteltes Layout | **LÖSCHEN (empfohlen, nicht ausgeführt)** — beschreibt eine verworfene Architekturrichtung |
| `triggers.md` | Frühe Erzähl-/SQL-Fassung der Scan-/Zähler-Trigger | Unvollständiger Entwurf, fehlt u.a. Delete-Trigger, Recalc-Helper, Indizes aus `db_triggers.sql` | **LÖSCHEN (empfohlen, nicht ausgeführt)** — durch `db_triggers.sql`/`doc/db/triggers.md` ersetzt |
| `useUser.md` | Spezifikation für `useUser`-Modul | Pfad/Struktur veraltet (ein Modul geplant, real drei Schichten: `useUser.js` + `useSupabaseUser.js` + `stores/user.js`, LocalForage statt localStorage) | **AKTUALISIERT** — Status-Vermerk mit realer Aufteilung ergänzt |

## `doc/` — Datenbank/SQL

| Datei | Inhalt | Abgleich mit Code | Entscheidung |
|---|---|---|---|
| `backup.sql` | HeidiSQL-Dump-Vorlage | Nur Kommentarzeilen, keine echte DDL, faktisch leer | **LÖSCHEN (empfohlen, nicht ausgeführt)** |
| `database_migration.sql` | DDL für `c_bands`, `groups`, `scan_type`, u.a. | Diese Tabellen existieren nicht (mehr) — laut `db_children_scans_days.txt` bewusst entfernt | **LÖSCHEN (empfohlen, nicht ausgeführt)** — beschreibt verworfenes Schema |
| `database_migration_config_rls.sql` | RLS-Policies für `public.config` | Stimmt exakt mit `stores/config.js` überein | **BEHALTEN** |
| `db_children_scans_days.txt` | Überarbeitetes vereinfachtes Schema (children/scans/days) + unstrukturierte Notiz zu Scan-Deduplizierung | SQL-Teil konsistent mit aktueller Code-Nutzung; Notiz war reines Brainstorming | **AKTUALISIERT** — Fließtext-Notiz zu einer kompakten "offene Idee"-Anmerkung gekürzt, SQL unverändert belassen |
| `db_triggers.sql` | Vollständiges Trigger-Set (`on_scan_insert`, `on_children_today_change`, Recalc-Helper, Indizes) | Dient mangels `supabase/migrations/`-Ordner als Source-of-Truth fürs Schema | **BEHALTEN** |
| `table_structure.md` | DDL für `children`, `scans`, `children_today`, `groups_today`, `reset_events` | Korrekt, aber unvollständig — `users`, `user_group_day`, `config`, `days` fehlten, obwohl aktiv im Code verwendet | **AKTUALISIERT** — fehlende vier Tabellen ergänzt |
| `genkeys_curl.bat` | curl-Beispiel für `invite-generate`-Edge-Function | Passt zu `supabase/functions/invite-generate/index.ts`, keine Secrets | **BEHALTEN** |
| `sb_install_keys.bat` | `supabase secrets set`-Befehle | Enthält den echten service_role-Key (siehe Sicherheitsfund oben) | **BEHALTEN (unverändert, auf ausdrücklichen Wunsch)** |
| `supabase_install.md` | Deploy-/Secrets-Befehle | Duplikat von `sb_install_keys.bat`, gleicher Key | **BEHALTEN (unverändert, auf ausdrücklichen Wunsch)** |
| `users.sql` | DDL `public.users` + Bootstrap-SuperAdmin + RLS | Schema stimmt mit `stores/user.js` überein; enthält echte Zugangsdaten (siehe Sicherheitsfund) | **BEHALTEN (unverändert, auf ausdrücklichen Wunsch)** |
| `migration_guide.md` | Migration von `localStorage` zu LocalForage (Ticket 105) | `src/modules/storage.js` entspricht der Beschreibung | **BEHALTEN** |
| `band.psd` (802 KB) | Photoshop-Datei, vermutlich Armband-Design-Quelle | Keine textuelle Referenz gefunden, aber auch kein Hinweis auf Überholtheit | **BEHALTEN** (bei Gelegenheit mit Eigentümer bestätigen, ob noch aktive Design-Quelle) |

## `doc/db/`

| Datei | Inhalt | Abgleich mit Code | Entscheidung |
|---|---|---|---|
| `adminBusView.md` | Architekturübersicht (Komponentenhierarchie, Datenfluss) für AdminBusView | Struktur korrekt, aber Route `/admin/buses` (real: `/admin-busses`) und Zeilenangabe „450 Zeilen“ (real: ~889) waren veraltet | **AKTUALISIERT** — Route global korrigiert, Zeilenangabe präzisiert |
| `days_rls.sql` | RLS-Fix für `public.days` (Ticket 102) mit Ursachenerklärung | Konsistent mit `useDays.js` | **BEHALTEN** |
| `triggers.md` | Reine SQL-Datei | **Byte-identisches Duplikat** von `doc/db_triggers.sql` (verifiziert per `diff`, keine Abweichung) | **LÖSCHEN (empfohlen, nicht ausgeführt)** — Root-Version als einzige Quelle behalten |

## `doc/utils/`

| Datei | Inhalt | Entscheidung |
|---|---|---|
| `bus-gen.html`, `group-gen.html` | Eigenständige jsPDF/QR-Generatoren für Bus-/Gruppenlisten | **BEHALTEN** |
| `info.html` | Statischer HTML-Prototyp „Stadtranderholung Selm 2025" | Keine Referenz im Code, wirkt wie ein früher Prototyp vor `InfoView.vue` | **LÖSCHEN (empfohlen, nicht ausgeführt)** |
| `qr-gen.html` | QR-Armband-Generator, fixer `n=`-Parameter | Durch `qr-gen1.html` (konfigurierbarer Parametername, Muster-Skalierung) ersetzt | **LÖSCHEN (empfohlen, nicht ausgeführt)** |
| `qr-gen1.html` | Neuere Version des QR-Generators | Passt zum aktuellen `?n=id`-Scan-Schema im Router | **BEHALTEN** |
| `1.png`, `2.png`, `узор.png` | Beispiel-Outputs/Muster-Textur | Keine textuelle Referenz, vermutlich Generator-Beispiele | **BEHALTEN** |
| `icons/` (README.txt, build_font.md/.pe, download_svgs.py, manifest_full.csv, urls_example.txt) | Eigenständiges Toolkit zum Bauen einer Icon-Font aus 162 SVGs | Nicht in den Build eingebunden, aber in sich geschlossenes Zukunfts-Tooling | **BEHALTEN** |

---

## Ausgeführte Änderungen in diesem Durchgang

- `project_packer.py`: fehlenden `elif`-Zweig ergänzt (Bugfix, Datei war syntaktisch defekt)
- `doc/ArmbandTask.md`: veraltete Datei-/Modulnamen korrigiert, Status-Vermerk ergänzt
- `doc/selectGroupAndBus.md`: Status-Vermerk mit realer Komponentenzuordnung ergänzt
- `doc/useUser.md`: Status-Vermerk zur realen 3-Schichten-Architektur ergänzt
- `doc/table_structure.md`: vier fehlende Tabellen ergänzt (`users`, `user_group_day`, `config`, `days`)
- `doc/db_children_scans_days.txt`: unstrukturierte Brainstorming-Notiz zu einer kompakten Anmerkung gekürzt
- `doc/db/adminBusView.md`: veraltete Route (`/admin/buses` → `/admin-busses`) und Zeilenangabe korrigiert

**Keine Datei wurde gelöscht** (siehe Hinweis oben). Alle mit „LÖSCHEN (empfohlen, nicht ausgeführt)" markierten Dateien liegen unverändert im Repo.

## Zur Frage „Reverse-Engineering der Dokumentation"

Nicht notwendig: Nach der obigen Durchsicht ist der verbleibende Dokumentationsbestand (Tech-Task-Dokumente + `doc/db/`-Schema-Dokumente + `readme.md`) inhaltlich ausreichend aktuell und deckt Architektur, Datenmodell und Kernlogik ab — größere Lücken wurden durch die oben aufgeführten Aktualisierungen geschlossen. Eine vollständige Neuerstellung der Dokumentation aus dem Quellcode wird nicht für erforderlich gehalten.
