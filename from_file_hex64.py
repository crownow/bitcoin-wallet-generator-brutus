import os
import re

# Папка с файлами
input_folder = "/Users/avraam/Downloads/password/"
output_file = "filtered_hex_keys.txt"

# Регулярное выражение: ровно 64 символа, только 0-9 и a-f
hex_pattern = re.compile(r'^[0-9a-f]{64}$')

# Множество уже найденных хешей (чтобы избежать дубликатов)
existing_keys = set()

# Если выходной файл уже существует, загружаем найденные ключи
if os.path.exists(output_file):
    with open(output_file, "r") as out_file:
        existing_keys.update(out_file.read().splitlines())

# Проходим по каждому файлу в папке
for filename in os.listdir(input_folder):
    file_path = os.path.join(input_folder, filename)

    # Пропускаем, если это не файл
    if not os.path.isfile(file_path):
        continue

    print(f"Обрабатываю файл: {filename}")

    # Читаем файл построчно и фильтруем
    with open(file_path, "r", encoding="utf-8", errors="ignore") as infile, open(output_file, "a") as outfile:
        for line in infile:
            clean_line = line.strip().lower()  # Убираем пробелы и перевод строки + приводим к нижнему регистру
            if hex_pattern.match(clean_line) and clean_line not in existing_keys:
                outfile.write(clean_line + "\n")
                existing_keys.add(clean_line)  # Добавляем в множество (чтобы избежать повторов)

print(f"✅ Фильтрация завершена! Найденные ключи сохранены в {output_file}")
