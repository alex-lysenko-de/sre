# Дашборд тикетов

Обзорная доска, показывающая порядок выполнения тикетов. После создания нового тикета или смены его статуса — обновлять эту таблицу.

| № | Название | Статус |
|---|----------|--------|
| [101](101/101.txt) | Config: ошибка доступа "keine Rechte" для Hauptbetreuer | DONE |
| [102](102/102.txt) | Days-edit: удаление дня не сохраняется в БД (появляется снова после reload) | DONE |
| [103](103/103.txt) | Scanner: выбор камеры на iPhone (селфи вместо основной) + громкость/вибрация/визуальный фидбек | DONE |
| [104](104/104.txt) | AdminBusView (/admin-busses): упрощение интерфейса, отступы, шрифты | DONE |
| [105](105/105.txt) | Миграция хранения авторизации с Local Storage на LocalForage | CHANGES_REQUIRED |
| [106](106/106.txt) | Kopfzählung (Headcount) для "Meine Gruppe" | FIXES_APPLIED |
| [107](107/107.md) | Ревизия и уборка файлов проекта / документации | AUDIT_DONE |
| [108](108/108.md) | База знаний проекта (Obsidian vault) | DONE |
| [109](109/109.md) | Пользовательская документация | не начат |
| [110](110/110.md) | Миграция в сторону multi-tenant (план) | не начат |
| [111](111 — DB backup tooling, коммит 17e206d, без файла в tickets/) | Backup-тулинг для БД (pg_dump schema+data) | DONE (только в git-истории) |
| [112](112/112.txt) | Сохранение авторизации в PWA на iPhone (Safari / Add to Home Screen) | DEVELOPMENT_DONE |
| [114](114/114.txt) | Bug fix: редирект на /info вместо home page после логина/регистрации | DONE |
| [115](115/115.txt) | Bug fix: работа с группой "null" | DONE |
| [113](113/113.txt) | Автоматическое создание PWA-приложения | CHANGES_REQUIRED |
| [117](117/117.txt) | LocalForage ↔ Supabase: архитектура обмена данными | тикет создан |
| [116](116/116.txt) | UI-прототип нового сканера (для будущей функциональности тикета 120; существующий `/scanner` не меняется). Решения зафиксированы в [tickets/116/DECISIONS.md](116/DECISIONS.md). Реализовано по [tickets/116/IMPLEMENTATION_PLAN.md](116/IMPLEMENTATION_PLAN.md) — 2 слоя (`Scanner.vue` + `ScannerPrototypeView.vue`), новый маршрут `/scanner-prototype`, кнопка "Отправить" — заглушка. Ручное тестирование на реальных устройствах не выполнено (см. `IMPLEMENTATION_REPORT.md`) | DEVELOPMENT_DONE |
| [118](118/118.txt) | Рефакторинг документации: уборка doc/ после базы знаний + компактная сводка для ИИ (CLAUDE.md). Backlog нереализованных идей AdminBusView, спасённый из удалённого `doc/AdminBusView_TechTask.md`: [tickets/118/AdminBusView_Backlog.md](118/AdminBusView_Backlog.md) | FIXES_APPLIED |
| [120](120/120.txt) | Модуль перекличек: 3 подрежима сканирования (автобус/группа/свободные отметки) поверх базового сканера, пакетная отправка результатов (PresencePacket). Решения зафиксированы в [tickets/120/DECISIONS.md](120/DECISIONS.md). Архитектурный план: [tickets/120/IMPLEMENTATION_PLAN.md](120/IMPLEMENTATION_PLAN.md) — чисто клиентский тикет (переиспользует `Scanner.vue`/`useScannerFeedback.js` из 116, три экрана-режима, реальный вызов `submit-scan-packet`); объём сужен относительно `DECISIONS.md` — серверное хранение и `AdminBusView.vue` перенесены в 122 (обоснование в самом плане) | ARCHITECT_DONE |
| [121](121/121.txt) | Research: сравнение архитектурных вариантов серверной обработки пакетов сканирования (подготовка к 122). Результат: [tickets/121/IMPLEMENTATION_PLAN.md](121/IMPLEMENTATION_PLAN.md) — вариант A (заголовок пакета + переиспользование `scans`) с обязательной пакетной переработкой триггеров (устранение N-кратных каскадов), Edge Function `submit-scan-packet`, идемпотентность по `client_packet_id`, схема заранее совместима с будущей отменой пакета | ARCHITECT_DONE |
| [122](122/122.txt) | Переработка серверной логики обработки результатов сканирования (приём/хранение ScanPacket, идемпотентность, UI администратора) — реализуется одновременно с 120, на основе research-а 121. План: [tickets/122/IMPLEMENTATION_PLAN.md](122/IMPLEMENTATION_PLAN.md) — таблица `scan_packets`, батч-триггеры (transition tables), Edge Function `submit-scan-packet` + функция БД `submit_scan_packet()`, новые экраны `GroupDetailModal.vue`/`ScanPacketList.vue` | ARCHITECT_DONE |
