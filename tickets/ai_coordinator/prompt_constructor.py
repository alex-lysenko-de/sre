#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prompt Constructor
===================

Настольное приложение (Tkinter) для интерактивной сборки промптов
из заранее подготовленных шаблонов (*.txt), лежащих рядом с программой.

Формат шаблона описан в ТЗ:

    [SECTION name=... class=... default=1]
    ...текст / вложенные SECTION...
    [/SECTION]

Используется только стандартная библиотека Python.

Версия 2: чекбоксы отображаются НЕ отдельным деревом, а прямо внутри
текста шаблона (так виден контекст каждой секции), а результат
перегенерируется автоматически при любом изменении входных данных
(тикет, чекбокс, переключение вкладки, Reset) — без ручного нажатия
кнопки Generate.

Версия 3: добавлена интеграция с AI-агентом (Claude Code CLI).
Поле "Рабочий каталог" + кнопка "Запустить агента" открывают консольное
окно (cmd.exe на Windows, обычный shell на прочих платформах),
переходят в указанный каталог и выполняют команду `claude`. Прямой
запуск `claude.exe` не используется, т.к. в интерактивном сценарии
CLI-обёртка `claude` должна быть запущена именно через shell. Название
активной вкладки передаётся как параметр командной строки — это
начальный промпт интерактивной сессии Claude Code (`claude "текст"`
открывает сессию сразу с этим промптом).

Версия 4: вкладки вынесены в прокручиваемый вертикальный список слева
(вместо горизонтального ttk.Notebook), т.к. при большом числе шаблонов
горизонтальные вкладки становятся слишком узкими и нечитаемыми.
Названия шаблонов всегда отображаются полностью, список прокручивается
при нехватке места по вертикали.

Версия 5: файлы шаблонов (*.txt) больше не читаются из каталога со
скриптом. Они загружаются из отдельной подпапки "prompts", лежащей
рядом со скриптом (создаётся автоматически, если отсутствует).
"""

import os
import re
import sys
import subprocess
import configparser
import tkinter as tk
from tkinter import ttk, messagebox

# Каталог, где лежит сам скрипт (а не текущий рабочий каталог процесса) —
# от него отсчитываются каталог промптов и файл конфигурации, чтобы
# программа работала одинаково независимо от того, откуда её запустили.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")
CONFIG_FILE = os.path.join(BASE_DIR, "prompt_constructor.ini")

TICKET_PLACEHOLDER = "{{TICKET}}"
DEFAULT_WORKDIR = "c:\\_projects\\github\\sre\\"
AGENT_COMMAND = "claude"

# --------------------------------------------------------------------------
# Разбор шаблонов
# --------------------------------------------------------------------------


class TemplateParseError(Exception):
    """Ошибка разбора шаблона — файл не может быть использован для генерации."""

    def __init__(self, filename, line, message):
        self.filename = filename
        self.line = line
        self.message = message
        super().__init__(f"{filename}, строка {line}: {message}")


class Section:
    """Один узел SECTION в дереве шаблона."""

    __slots__ = ("name", "cls", "default", "enabled", "children", "line")

    def __init__(self, name, cls, default, line):
        self.name = name
        self.cls = cls
        self.default = default   # bool — состояние после Reset
        self.enabled = default   # bool — текущее состояние (до применения INI)
        self.children = []       # список: str | Section
        self.line = line


_TAG_RE = re.compile(r"\[SECTION([^\]]*)\]|\[/SECTION\]")
_ATTR_RE = re.compile(r'(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*(\S+)')


def _parse_attrs(attr_str):
    attrs = {}
    for m in _ATTR_RE.finditer(attr_str):
        if m.group(1) is not None:
            key, val = m.group(1), m.group(2)
        else:
            key, val = m.group(3), m.group(4)
        attrs[key] = val
    return attrs


def _parse_default(raw):
    """default отсутствует -> True; default=1 -> True; default=0 -> False.
    Прочие значения не используются -> трактуем как отсутствие (True)."""
    if raw is None:
        return True
    if raw == "1":
        return True
    if raw == "0":
        return False
    return True


def parse_template(text, filename):
    """Разбирает содержимое файла в дерево узлов (список str | Section).

    Бросает TemplateParseError при незакрытой/лишней закрывающей секции.
    """
    pos = 0
    root = []
    stack = [root]        # стек списков-контейнеров (текущие "children")
    open_sections = []    # стек открытых Section (для проверки закрытия)

    for m in _TAG_RE.finditer(text):
        pre = text[pos:m.start()]
        if pre:
            stack[-1].append(pre)
        pos = m.end()

        if m.group(0) == "[/SECTION]":
            if not open_sections:
                line = text.count("\n", 0, m.start()) + 1
                raise TemplateParseError(
                    filename, line,
                    "Обнаружен закрывающий тег [/SECTION] без соответствующего "
                    "открывающего тега (лишняя или пересекающаяся секция)."
                )
            open_sections.pop()
            stack.pop()
        else:
            attrs = _parse_attrs(m.group(1) or "")
            line = text.count("\n", 0, m.start()) + 1
            sec = Section(
                name=attrs.get("name"),
                cls=attrs.get("class"),
                default=_parse_default(attrs.get("default")),
                line=line,
            )
            stack[-1].append(sec)
            open_sections.append(sec)
            stack.append(sec.children)

    tail = text[pos:]
    if tail:
        stack[-1].append(tail)

    if open_sections:
        unclosed = open_sections[-1]
        raise TemplateParseError(
            filename, unclosed.line,
            "Не найден закрывающий тег [/SECTION] для секции, открытой здесь."
        )

    return root


def iter_sections(nodes):
    """Рекурсивно обходит все Section в дереве (в порядке появления)."""
    for n in nodes:
        if isinstance(n, Section):
            yield n
            yield from iter_sections(n.children)


def validate_unique_names(nodes, filename):
    """В пределах одного файла имя (name) должно быть уникальным."""
    seen = set()
    for sec in iter_sections(nodes):
        if sec.name:
            if sec.name in seen:
                raise TemplateParseError(
                    filename, sec.line,
                    f"Повторяющееся имя секции name='{sec.name}' в пределах одного файла."
                )
            seen.add(sec.name)


def render(nodes):
    """Собирает итоговый текст: выключенные секции и управляющие теги удаляются."""
    out = []
    for n in nodes:
        if isinstance(n, str):
            out.append(n)
        else:
            if n.enabled:
                out.append(render(n.children))
    return "".join(out)


# --------------------------------------------------------------------------
# Приложение
# --------------------------------------------------------------------------


class PromptConstructorApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Prompt Constructor")
        self.geometry("1200x720")

        try:
            self.tk.call("tk", "scaling", 1.3)
        except tk.TclError:
            pass

        self.files = {}          # filename -> {"nodes": [...]}
        self.class_registry = {} # cls -> [Section, ...] (across all files)
        self.section_vars = {}   # Section -> tk.BooleanVar
        # Section -> {"text_widget":.., "tag":.., "range":(start,end)}
        self.section_display = {}

        self.ticket_var = tk.StringVar()
        self.workdir_var = tk.StringVar()
        self.status_var = tk.StringVar(value="")
        self.dirty_var = tk.StringVar(value="")

        self._suppress_modified = False
        self.text_dirty = False
        self._ui_ready = False   # чтобы не генерировать во время построения UI

        self.config_parser = configparser.ConfigParser()
        self._saved_states = {}
        self._saved_ticket = ""
        self._saved_last_tab = ""

        self._load_config()
        errors = self._load_templates()
        self._build_ui()
        self._restore_last_tab()

        # первичная генерация для изначально выбранной вкладки
        self.on_generate()
        self._ui_ready = True

        if errors:
            messagebox.showerror(
                "Ошибки в шаблонах",
                "Следующие файлы содержат ошибки и не будут использоваться "
                "для генерации:\n\n" + "\n\n".join(errors),
            )

        self.protocol("WM_DELETE_WINDOW", self.on_close)

    # ---------------------------------------------------------- config ----

    def _load_config(self):
        if os.path.exists(CONFIG_FILE):
            try:
                self.config_parser.read(CONFIG_FILE, encoding="utf-8")
            except (configparser.Error, OSError):
                pass
        self._saved_ticket = self.config_parser.get("General", "ticket", fallback="")
        self._saved_last_tab = self.config_parser.get("General", "last_tab", fallback="")
        self._saved_workdir = self.config_parser.get(
            "General", "workdir", fallback=DEFAULT_WORKDIR
        )
        if self.config_parser.has_section("States"):
            self._saved_states = dict(self.config_parser["States"])
        self.ticket_var.set(self._saved_ticket)
        self.workdir_var.set(self._saved_workdir)

    def _save_config(self):
        cfg = configparser.ConfigParser()
        cfg["General"] = {
            "ticket": self.ticket_var.get(),
            "last_tab": self._current_tab_filename() or "",
            "workdir": self.workdir_var.get(),
        }
        states = {}
        for filename, data in self.files.items():
            for sec in iter_sections(data["nodes"]):
                if sec.name:
                    states[f"{filename}.{sec.name}"] = "true" if sec.enabled else "false"
        cfg["States"] = states
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                cfg.write(f)
        except OSError as e:
            messagebox.showwarning("Сохранение настроек", f"Не удалось сохранить настройки: {e}")

    # -------------------------------------------------------- templates ---

    def _load_templates(self):
        errors = []

        try:
            os.makedirs(PROMPTS_DIR, exist_ok=True)
        except OSError as e:
            errors.append(f"Не удалось создать каталог промптов «{PROMPTS_DIR}»: {e}")
            return errors

        try:
            filenames = sorted(
                f for f in os.listdir(PROMPTS_DIR)
                if f.lower().endswith(".txt")
                and os.path.isfile(os.path.join(PROMPTS_DIR, f))
            )
        except OSError as e:
            errors.append(f"Не удалось прочитать каталог промптов «{PROMPTS_DIR}»: {e}")
            filenames = []

        for filename in filenames:
            filepath = os.path.join(PROMPTS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as fh:
                    content = fh.read()
            except UnicodeDecodeError:
                errors.append(f"{filename}: файл не в кодировке UTF-8.")
                continue
            except OSError as e:
                errors.append(f"{filename}: не удалось прочитать файл ({e}).")
                continue

            try:
                nodes = parse_template(content, filename)
                validate_unique_names(nodes, filename)
            except TemplateParseError as e:
                errors.append(str(e))
                continue

            for sec in iter_sections(nodes):
                if sec.name:
                    key = f"{filename}.{sec.name}"
                    if key in self._saved_states:
                        sec.enabled = self._saved_states[key].strip().lower() in (
                            "1", "true", "yes", "on"
                        )
                if sec.cls:
                    self.class_registry.setdefault(sec.cls, []).append(sec)

            self.files[filename] = {"nodes": nodes}

        return errors

    # --------------------------------------------------------------- UI ---

    def _build_ui(self):
        paned = ttk.Panedwindow(self, orient="horizontal")
        paned.pack(fill="both", expand=True)

        left_frame = ttk.Frame(paned, padding=6)
        right_frame = ttk.Frame(paned, padding=6)
        paned.add(left_frame, weight=1)
        paned.add(right_frame, weight=1)

        # --- верх левой панели: Ticket / Generate / Reset ---
        top_bar = ttk.Frame(left_frame)
        top_bar.pack(fill="x", pady=(0, 6))

        ttk.Label(top_bar, text="Ticket:").pack(side="left")
        ticket_entry = ttk.Entry(top_bar, textvariable=self.ticket_var, width=20)
        ticket_entry.pack(side="left", padx=(4, 10))
        # автогенерация при каждом изменении номера тикета
        self.ticket_var.trace_add("write", self._on_ticket_changed)

        ttk.Button(top_bar, text="Generate", command=lambda: self.on_generate()).pack(
            side="left", padx=2
        )
        ttk.Button(top_bar, text="Reset", command=self.on_reset).pack(side="left", padx=2)

        ttk.Label(
            top_bar, text="(результат обновляется автоматически)", foreground="#888888"
        ).pack(side="left", padx=10)

        # --- строка запуска AI-агента (Claude Code) ---
        agent_bar = ttk.Frame(left_frame)
        agent_bar.pack(fill="x", pady=(0, 6))

        ttk.Label(agent_bar, text="Рабочий каталог:").pack(side="left")
        workdir_entry = ttk.Entry(agent_bar, textvariable=self.workdir_var)
        workdir_entry.pack(side="left", padx=(4, 10), fill="x", expand=True)

        ttk.Button(agent_bar, text="Запустить агента", command=self.on_launch_agent).pack(
            side="left"
        )

        # --- навигация по шаблонам: вертикальный прокручиваемый список ---
        # Вместо горизонтальных вкладок ttk.Notebook (которые становятся
        # нечитаемыми при большом количестве промптов) используется список
        # слева (с вертикальной прокруткой) + стек панелей с содержимым
        # справа от него. Названия шаблонов всегда отображаются полностью.
        tabs_area = ttk.Frame(left_frame)
        tabs_area.pack(fill="both", expand=True)

        list_frame = ttk.Frame(tabs_area, width=220)
        list_frame.pack(side="left", fill="y")
        list_frame.pack_propagate(False)

        ttk.Label(list_frame, text="Промпты:").pack(anchor="w")

        list_inner = ttk.Frame(list_frame)
        list_inner.pack(fill="both", expand=True, pady=(2, 0))

        self.tab_listbox = tk.Listbox(
            list_inner, exportselection=False, activestyle="dotbox",
        )
        list_scroll = ttk.Scrollbar(
            list_inner, orient="vertical", command=self.tab_listbox.yview
        )
        self.tab_listbox.configure(yscrollcommand=list_scroll.set)
        self.tab_listbox.pack(side="left", fill="both", expand=True)
        list_scroll.pack(side="right", fill="y")
        # прокрутка колесом мыши, даже если курсор не точно над списком
        self.tab_listbox.bind(
            "<MouseWheel>",
            lambda e: self.tab_listbox.yview_scroll(int(-1 * (e.delta / 120)), "units"),
        )
        self.tab_listbox.bind(
            "<Button-4>", lambda e: self.tab_listbox.yview_scroll(-1, "units")
        )
        self.tab_listbox.bind(
            "<Button-5>", lambda e: self.tab_listbox.yview_scroll(1, "units")
        )

        content_stack = ttk.Frame(tabs_area)
        content_stack.pack(side="left", fill="both", expand=True, padx=(6, 0))
        content_stack.grid_rowconfigure(0, weight=1)
        content_stack.grid_columnconfigure(0, weight=1)

        self.tab_frames = {}   # filename -> контейнер (для tkraise)
        self._current_filename = None
        self._tab_order = []   # порядок имён файлов, соответствующий строкам Listbox

        if not self.files:
            empty = ttk.Frame(content_stack)
            ttk.Label(
                empty,
                text=(
                    "В каталоге промптов не найдено ни одного *.txt шаблона:\n"
                    f"{PROMPTS_DIR}"
                ),
                padding=20,
            ).pack()
            empty.grid(row=0, column=0, sticky="nsew")
            self.tab_listbox.insert("end", "(пусто)")
            self.tab_listbox.configure(state="disabled")
        else:
            for filename in sorted(self.files):
                tab_container, text_widget = self._make_template_tab(content_stack)
                self.build_section_text(text_widget, self.files[filename]["nodes"], 0)
                text_widget.configure(state="disabled")
                tab_container.grid(row=0, column=0, sticky="nsew")
                self.tab_frames[filename] = tab_container
                self.tab_listbox.insert("end", filename)
                self._tab_order.append(filename)

        # выбор строки в списке -> показать соответствующую панель + автогенерация
        self.tab_listbox.bind("<<ListboxSelect>>", self._on_tab_changed)

        # --- правая панель: результат ---
        editor_bar = ttk.Frame(right_frame)
        editor_bar.pack(fill="x")
        ttk.Label(editor_bar, text="Результат:").pack(side="left")
        ttk.Label(editor_bar, textvariable=self.dirty_var, foreground="#b35c00").pack(
            side="left", padx=8
        )

        text_frame = ttk.Frame(right_frame)
        text_frame.pack(fill="both", expand=True, pady=(4, 4))

        self.output_text = tk.Text(text_frame, wrap="word", undo=True)
        out_scroll = ttk.Scrollbar(text_frame, orient="vertical", command=self.output_text.yview)
        self.output_text.configure(yscrollcommand=out_scroll.set)
        self.output_text.pack(side="left", fill="both", expand=True)
        out_scroll.pack(side="right", fill="y")
        self.output_text.bind("<<Modified>>", self._on_text_modified)

        bottom_bar = ttk.Frame(right_frame)
        bottom_bar.pack(fill="x")
        ttk.Button(bottom_bar, text="Copy", command=self.on_copy).pack(side="left")
        ttk.Label(bottom_bar, textvariable=self.status_var, foreground="#666666").pack(
            side="left", padx=10
        )

    def _make_template_tab(self, parent):
        """Одна вкладка = прокручиваемый Text с текстом шаблона и встроенными
        чекбоксами прямо внутри текста (чтобы был виден контекст)."""
        container = ttk.Frame(parent)
        text_widget = tk.Text(
            container, wrap="word", borderwidth=0, highlightthickness=0,
            cursor="arrow", padx=8, pady=6,
        )
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=text_widget.yview)
        text_widget.configure(yscrollcommand=scrollbar.set)
        text_widget.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        return container, text_widget

    def build_section_text(self, text_widget, nodes, depth):
        """Рекурсивно вставляет текст шаблона в Text-виджет, встраивая
        чекбокс прямо перед содержимым каждой секции. Выключенные секции
        остаются видимыми (серым, зачёркнутым текстом) — так сохраняется
        контекст, в котором находится каждый переключатель."""
        if depth > 0:
            tag = f"indent{depth}"
            text_widget.tag_configure(tag, lmargin1=depth * 18, lmargin2=depth * 18)

        for n in nodes:
            if isinstance(n, str):
                start = text_widget.index("insert")
                text_widget.insert("insert", n)
                end = text_widget.index("insert")
                if depth > 0:
                    text_widget.tag_add(f"indent{depth}", start, end)
            else:
                sec = n
                self._insert_section_checkbox(text_widget, sec, depth)

                content_start = text_widget.index("insert")
                self.build_section_text(text_widget, sec.children, depth + 1)
                content_end = text_widget.index("insert")

                tagname = f"secdisabled_{id(sec)}"
                text_widget.tag_configure(
                    tagname, foreground="#9a9a9a", overstrike=True
                )
                self.section_display[sec] = {
                    "text_widget": text_widget,
                    "tag": tagname,
                    "range": (content_start, content_end),
                }
                if not sec.enabled:
                    text_widget.tag_add(tagname, content_start, content_end)

    def _insert_section_checkbox(self, text_widget, sec, depth):
        # переносим чекбокс на новую строку, если мы не в начале строки
        cur = text_widget.index("insert")
        line_start = text_widget.index("insert linestart")
        if cur != line_start:
            text_widget.insert("insert", "\n")

        if sec.name:
            label = sec.name
        elif sec.cls:
            label = f"[class: {sec.cls}]"
        else:
            label = f"(секция, строка {sec.line})"
        if sec.cls and sec.name:
            label += f"  [class: {sec.cls}]"

        var = tk.BooleanVar(value=sec.enabled)
        self.section_vars[sec] = var

        cb = ttk.Checkbutton(
            text_widget, text=label, variable=var,
            command=lambda s=sec, v=var: self.on_toggle(s, v),
        )
        text_widget.window_create("insert", window=cb, align="top")
        text_widget.insert("insert", "\n")

        if depth > 0:
            text_widget.tag_add(f"indent{depth}", line_start, text_widget.index("insert"))

    def _refresh_visual(self, sec):
        info = self.section_display.get(sec)
        if not info:
            return
        tw = info["text_widget"]
        tag = info["tag"]
        start, end = info["range"]
        if sec.enabled:
            tw.tag_remove(tag, start, end)
        else:
            tw.tag_add(tag, start, end)

    def _restore_last_tab(self):
        if not self._tab_order:
            return
        target = self._saved_last_tab if self._saved_last_tab in self._tab_order else None
        if target is None:
            target = self._tab_order[0]
        self._select_tab(target)

    def _select_tab(self, filename):
        """Показывает панель с указанным именем файла и выделяет его в списке."""
        if filename not in self.tab_frames:
            return
        idx = self._tab_order.index(filename)
        self.tab_listbox.selection_clear(0, "end")
        self.tab_listbox.selection_set(idx)
        self.tab_listbox.activate(idx)
        self.tab_listbox.see(idx)
        self.tab_frames[filename].tkraise()
        self._current_filename = filename

    # ------------------------------------------------------------ логика -

    def _current_tab_filename(self):
        if self._current_filename in self.files:
            return self._current_filename
        return None

    def on_toggle(self, section, var):
        value = var.get()
        section.enabled = value
        self._refresh_visual(section)
        if section.cls:
            for sibling in self.class_registry.get(section.cls, []):
                if sibling is not section:
                    sibling.enabled = value
                    sib_var = self.section_vars.get(sibling)
                    if sib_var is not None:
                        sib_var.set(value)
                    self._refresh_visual(sibling)
        # любое изменение чекбокса сразу перегенерирует результат
        self.on_generate()

    def _on_ticket_changed(self, *_args):
        if not self._ui_ready:
            return
        self.on_generate()

    def _on_tab_changed(self, _event=None):
        selection = self.tab_listbox.curselection()
        if selection:
            idx = selection[0]
            if 0 <= idx < len(self._tab_order):
                filename = self._tab_order[idx]
                self.tab_frames[filename].tkraise()
                self._current_filename = filename
        if not self._ui_ready:
            return
        self.on_generate()

    def on_generate(self):
        """Полная регенерация результата для текущей вкладки.
        Вызывается автоматически при любом изменении (чекбокс, тикет,
        вкладка, Reset), а также вручную кнопкой Generate."""
        filename = self._current_tab_filename()
        if filename is None:
            self._set_output_text("")
            return

        nodes = self.files[filename]["nodes"]
        result = render(nodes)
        result = result.replace(TICKET_PLACEHOLDER, self.ticket_var.get())
        self._set_output_text(result)
        self.status_var.set(f"Обновлено автоматически из «{filename}».")

    def on_reset(self):
        filename = self._current_tab_filename()
        if filename is None:
            return
        nodes = self.files[filename]["nodes"]
        sections = list(iter_sections(nodes))

        for sec in sections:
            sec.enabled = sec.default
            var = self.section_vars.get(sec)
            if var is not None:
                var.set(sec.default)
            self._refresh_visual(sec)

        # синхронизация классов после Reset
        for sec in sections:
            if sec.cls:
                for sibling in self.class_registry.get(sec.cls, []):
                    if sibling is not sec:
                        sibling.enabled = sec.enabled
                        sib_var = self.section_vars.get(sibling)
                        if sib_var is not None:
                            sib_var.set(sibling.enabled)
                        self._refresh_visual(sibling)

        self.status_var.set(f"Состояния вкладки «{filename}» сброшены.")
        # Reset тоже меняет итоговое содержимое -> автогенерация
        self.on_generate()

    def on_launch_agent(self):
        """Открывает командную строку в указанном рабочем каталоге и
        запускает в ней CLI-команду `claude`.

        Прямой запуск `claude.exe` не используется, т.к. в интерактивном
        сценарии он не работает — вместо этого команда `claude` выполняется
        внутри полноценной оболочки (cmd.exe на Windows), которая
        предварительно переходит в рабочий каталог. Название активной
        вкладки передаётся команде как параметр — это начальный промпт
        интерактивной сессии Claude Code, поэтому агент открывается сразу
        в контексте выбранного промпта.
        """
        workdir = self.workdir_var.get().strip()
        if not workdir:
            messagebox.showerror("Запуск агента", "Не указан рабочий каталог.")
            return
        if not os.path.isdir(workdir):
            messagebox.showerror(
                "Запуск агента", f"Рабочий каталог не найден:\n{workdir}"
            )
            return

        tab_name = self._current_tab_filename()
        # Собираем команду `claude`, при наличии активной вкладки —
        # с её названием как позиционным аргументом (начальный промпт).
        agent_cmd = AGENT_COMMAND
        if tab_name:
            agent_cmd += f' /rename {tab_name}'

        try:
            if sys.platform.startswith("win"):
                # /d — переход на другой диск при необходимости;
                # /k — оставить консольное окно открытым после выполнения,
                # чтобы была видна интерактивная сессия Claude Code.
                shell_cmd = f' cd /d {workdir} && {agent_cmd}'
                subprocess.Popen(
                    ["cmd.exe", "/k", shell_cmd],
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                )
            else:
                # На прочих платформах — обычный shell в новом терминале
                # недоступен универсально, поэтому запускаем через shell
                # в текущем рабочем каталоге напрямую.
                shell_cmd = f'cd "{workdir}" && {agent_cmd}'
                subprocess.Popen(shell_cmd, shell=True, cwd=workdir)
        except FileNotFoundError:
            messagebox.showerror(
                "Запуск агента",
                "Не удалось найти командную оболочку для запуска агента." + shell_cmd,
            )
        except OSError as e:
            messagebox.showerror("Запуск агента", f"Не удалось запустить агента:\n{e}")
        else:
            if tab_name:
                self.status_var.set(
                    f"Агент запущен в «{workdir}» (контекст: {tab_name})."
                )
            else:
                self.status_var.set(f"Агент запущен в «{workdir}».")

    def on_copy(self):
        text = self.output_text.get("1.0", "end-1c")
        self.clipboard_clear()
        self.clipboard_append(text)
        self.status_var.set("Текст скопирован в буфер обмена.")

    def _set_output_text(self, text):
        self._suppress_modified = True
        self.output_text.delete("1.0", "end")
        self.output_text.insert("1.0", text)
        self.output_text.edit_modified(False)
        self._suppress_modified = False
        self.text_dirty = False
        self.dirty_var.set("")

    def _on_text_modified(self, event=None):
        if self._suppress_modified:
            self.output_text.edit_modified(False)
            return
        if self.output_text.edit_modified():
            self.text_dirty = True
            self.dirty_var.set("* отредактировано вручную (будет заменено при следующем изменении)")
            self.output_text.edit_modified(False)

    def on_close(self):
        self._save_config()
        self.destroy()


def main():
    app = PromptConstructorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
