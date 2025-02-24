import os
import hashlib
import base58
import ecdsa
import sys
import segwit_addr  # Bech32 и Bech32m кодировщик
from multiprocessing import Pool, cpu_count

# 📂 Папки
INPUT_FOLDER = "sha256_from_pass/hex"
OUTPUT_FOLDER = "sha256_from_pass/address"

# ⚡ Оптимизация многопроцессорности
NUM_PROCESSES = max(2, cpu_count() - 1)  # Используем все ядра, кроме 1

# 🔑 Функция для генерации WIF-ключа из HEX
def generate_wif(private_key_hex, compressed=True):
    extended_key = "80" + private_key_hex
    if compressed:
        extended_key += "01"
    first_sha256 = hashlib.sha256(bytes.fromhex(extended_key)).digest()
    second_sha256 = hashlib.sha256(first_sha256).digest()
    checksum = second_sha256[:4]
    final_key = extended_key + checksum.hex()
    return base58.b58encode(bytes.fromhex(final_key)).decode()

# 🔑 Функция для генерации публичных ключей (оба варианта)
def generate_public_keys(private_key_hex):
    private_key_bytes = bytes.fromhex(private_key_hex)
    sk = ecdsa.SigningKey.from_string(private_key_bytes, curve=ecdsa.SECP256k1)
    vk = sk.verifying_key

    # Генерация Uncompressed Public Key (начинается с 04, 65 байт)
    pubkey_uncompressed = (b'\x04' + vk.to_string()).hex()

    # Генерация Compressed Public Key (начинается с 02/03, 33 байта)
    prefix = b'\x02' if vk.pubkey.point.y() % 2 == 0 else b'\x03'
    pubkey_compressed = (prefix + vk.to_string()[:32]).hex()

    return pubkey_compressed, pubkey_uncompressed

# 🔑 Функция для генерации Bech32-адресов
def bech32_encode(hrp, witver, witprog):
    return segwit_addr.encode_segwit_address(hrp, witver, bytes(witprog))

# 🔑 Функция для генерации Bitcoin-адресов
def generate_bitcoin_addresses(private_key_hex, public_key_compressed, public_key_uncompressed):
    pubkey_bytes_compressed = bytes.fromhex(public_key_compressed)
    pubkey_bytes_uncompressed = bytes.fromhex(public_key_uncompressed)

    # 🔵 P2PKH (Legacy, начинается с "1")
    ripemd160_uncompressed = hashlib.new('ripemd160', hashlib.sha256(pubkey_bytes_uncompressed).digest()).digest()
    p2pkh_address_uncompressed = base58.b58encode_check(b'\x00' + ripemd160_uncompressed).decode()

    addresses = {"P2PKH (Uncompressed)": p2pkh_address_uncompressed}

    # Генерация адресов для сжатого ключа
    ripemd160_compressed = hashlib.new('ripemd160', hashlib.sha256(pubkey_bytes_compressed).digest()).digest()
    
    # 🟢 P2SH-P2WPKH (SegWit Nested, начинается с "3")
    p2sh_address = base58.b58encode_check(b'\x05' + ripemd160_compressed).decode()
    addresses["P2SH-P2WPKH (Compressed)"] = p2sh_address

    # 🔵 P2WPKH (Native SegWit, Bech32, начинается с "bc1q")
    p2wpkh_address = bech32_encode("bc", 0, ripemd160_compressed)  # Witness Version 0
    addresses["P2WPKH (Compressed)"] = p2wpkh_address

    # 🔴 P2TR (Taproot, Bech32m, начинается с "bc1p")
    taproot_sk = ecdsa.SigningKey.from_string(bytes.fromhex(private_key_hex), curve=ecdsa.SECP256k1)
    taproot_pk = taproot_sk.verifying_key.pubkey.point.x().to_bytes(32, "big")  # X-координата
    p2tr_address = bech32_encode("bc", 1, taproot_pk)  # Witness Version 1 (Bech32m)
    addresses["P2TR (Compressed)"] = p2tr_address

    return addresses

# 🔥 Функция обработки одной строки (HEX ключ -> адреса)
def process_hex_key(hex_key):
    if len(hex_key) != 64:
        return None  # Пропускаем некорректные строки

    # Генерация публичных ключей (оба сразу)
    pubkey_compressed, pubkey_uncompressed = generate_public_keys(hex_key)

    # Генерация адресов
    addresses = generate_bitcoin_addresses(hex_key, pubkey_compressed, pubkey_uncompressed)

    # Формируем строку для записи
    output_line = f"{hex_key} - {addresses['P2PKH (Uncompressed)']} - " \
                  f"{addresses['P2SH-P2WPKH (Compressed)']} - " \
                  f"{addresses['P2WPKH (Compressed)']} - " \
                  f"{addresses['P2TR (Compressed)']}\n"
    return output_line

# 📂 Обработка одного файла (многопроцессорно)
def process_file(file_path):
    print(f"📂 Обрабатываю файл: {file_path}")

    with open(file_path, "r", encoding="utf-8", errors="ignore") as infile:
        lines = [line.strip() for line in infile]

    # Используем multiprocessing только для обработки строк
    with Pool(NUM_PROCESSES) as pool:
        results = pool.map(process_hex_key, lines)

    # Фильтруем None (если были ошибки)
    results = [r for r in results if r]

    # Записываем в файл одной операцией
    output_path = os.path.join(OUTPUT_FOLDER, os.path.basename(file_path))
    with open(output_path, "w") as outfile:
        outfile.writelines(results)

    print(f"✅ Файл {file_path} обработан. Сохранен в {output_path}")

# 🔥 Запуск обработки (без multiprocessing для файлов)
def generate_addresses():
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)

    files = [os.path.join(INPUT_FOLDER, f) for f in os.listdir(INPUT_FOLDER) if os.path.isfile(os.path.join(INPUT_FOLDER, f))]

    # Запускаем обработку файлов последовательно, а внутри каждого файла — параллельно
    for file in files:
        process_file(file)

    print(f"✅ Генерация адресов завершена. Файлы сохранены в {OUTPUT_FOLDER}")

if __name__ == "__main__":
    generate_addresses()
