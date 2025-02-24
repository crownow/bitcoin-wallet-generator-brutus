import os
import base58
import binascii

# Папка с файлами
input_folder = "/Users/avraam/Downloads/password/"
output_file = "compressed_wif_keys.txt"

# Загружаем уже найденные ключи (чтобы избежать дубликатов)
existing_keys = set()
if os.path.exists(output_file):
    with open(output_file, "r") as out_file:
        existing_keys.update(out_file.read().splitlines())

# Проверка, является ли строка валидным сжатым WIF-ключом
def is_valid_compressed_wif(wif_key):
    try:
        decoded = base58.b58decode_check(wif_key)
        return len(decoded) == 34 and decoded[0] == 0x80 and decoded[-1] == 0x01  # Длина 34, первый байт 0x80, последний 0x01
    except (ValueError, binascii.Error):
        return False  # Ошибка декодирования

# Проходим по каждому файлу в папке
for filename in os.listdir(input_folder):
    file_path = os.path.join(input_folder, filename)

    # Пропускаем, если это не файл
    if not os.path.isfile(file_path):
        continue

    print(f"📂 Обрабатываю файл: {filename}")

    # Читаем файл построчно
    with open(file_path, "r", encoding="utf-8", errors="ignore") as infile, open(output_file, "a") as outfile:
        for line in infile:
            clean_line = line.strip()

            # Проверяем, является ли строка валидным сжатым WIF-ключом
            if clean_line.startswith(("K", "L")) and len(clean_line) == 52 and clean_line not in existing_keys:
                if is_valid_compressed_wif(clean_line):
                    outfile.write(clean_line + "\n")
                    existing_keys.add(clean_line)  # Добавляем в список уже записанных

print(f"✅ Готово! Все найденные **сжатые** WIF-ключи сохранены в {output_file}")
