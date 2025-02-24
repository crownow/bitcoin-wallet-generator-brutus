import os
import base58
import binascii

# Папка с файлами
input_folder = "/Users/avraam/Downloads/password/"
output_file = "uncompressed_wif_keys.txt"

# Загружаем уже найденные ключи (чтобы избежать дубликатов)
existing_keys = set()
if os.path.exists(output_file):
    with open(output_file, "r") as out_file:
        existing_keys.update(out_file.read().splitlines())

# Проверка, является ли строка валидным несжатым WIF-ключом
def is_valid_wif(wif_key):
    try:
        decoded = base58.b58decode_check(wif_key)
        if len(decoded) == 34 and decoded[0] == 0x80 and decoded[-1] == 0x01:
            return False  # Это сжатый WIF
        return len(decoded) == 33 and decoded[0] == 0x80  # Несжатый WIF
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

            # Проверяем, является ли строка валидным WIF-ключом
            if clean_line.startswith("5") and len(clean_line) in (51, 52) and clean_line not in existing_keys:
                if is_valid_wif(clean_line):
                    outfile.write(clean_line + "\n")
                    existing_keys.add(clean_line)  # Добавляем в список уже записанных

print(f"✅ Готово! Все найденные **несжатые** WIF-ключи сохранены в {output_file}")
