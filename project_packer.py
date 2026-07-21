import re
from pathlib import Path

OUTPUT_FILE = "all_project_files.md"
PROJECT_ROOT = Path(".")

# --- Разрешённые файлы и каталоги ---
ALLOWED_ROOT_FILES = {
    "vite.config.js",
    "package.json",
    "jsconfig.json",
    "index.html",
    ".env",
}
ALLOWED_DIRS = {"src", "supabase", ".github"}

# ---------- 1. Сборка проекта в один MD ----------
def pack_project_to_md(root_dir=PROJECT_ROOT, output_file=OUTPUT_FILE):
    with open(output_file, "w", encoding="utf-8") as out:
        out.write("## 📦 All project files\n\n")

        for path in sorted(root_dir.rglob("*")):
            rel_path = path.relative_to(root_dir)

            if path.is_dir():
                continue

            # фильтрация по разрешённым путям
            if (
                rel_path.parts[0] not in ALLOWED_DIRS
                and str(rel_path) not in ALLOWED_ROOT_FILES
            ):
                continue

            if path.name == output_file:
                continue

            out.write(f"### {rel_path}\n\n")
            out.write("```" + path.suffix.lstrip('.') + "\n")
            try:
                with open(path, "r", encoding="utf-8") as f:
                    out.write(f.read())
            except Exception as e:
                out.write(f"[Не удалось прочитать файл: {e}]")
            out.write("\n```\n\n")

    print(f"✅ Собрано в: {output_file}")


# ---------- 2. Восстановление проекта из MD ----------
def unpack_md_to_project(md_file=OUTPUT_FILE, target_root=PROJECT_ROOT):
    with open(md_file, "r", encoding="utf-8") as f:
        content = f.read()

    # шаблон: ### путь ... ```код```
    pattern = re.compile(r"^### (.+?)\n\n```(?:.*?)\n(.*?)\n```", re.M | re.S)
    matches = pattern.findall(content)

    if not matches:
        print("⚠️  Не найдено ни одного файла в .md")
        return

    for rel_path, file_content in matches:
        rel = Path(rel_path)
        # разрешаем только src/** и указанные файлы
        if (
            rel.parts[0] not in ALLOWED_DIRS
            and str(rel) not in ALLOWED_ROOT_FILES
        ):
            print(f"⏩ Пропущен (не разрешён): {rel_path}")
            continue

        file_path = target_root / rel
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w", encoding="utf-8") as out:
            out.write(file_content)

        print(f"📝 Перезаписан: {rel_path}")

    print("✅ Восстановление завершено!")


# ---------- CLI ----------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Пакует или распаковывает Vue-проект в один Markdown-файл (только src/ и разрешённые файлы в корне)."
    )
    parser.add_argument(
        "--mode",
        choices=["pack", "unpack"],
        required=True,
        help="pack — собрать файлы в all_project_files.md; unpack — восстановить файлы из него.",
    )
    args = parser.parse_args()

    if args.mode == "pack":
        pack_project_to_md()
    elif args.mode == "unpack":
        unpack_md_to_project()
