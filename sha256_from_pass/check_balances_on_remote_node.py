import json
import socket
import os
import time
import random
import hashlib
import base58
import segwit_addr
import threading
import logging
from queue import Queue

# 📂 Папки
INPUT_FOLDER = "sha256_from_pass/address"
OUTPUT_FILE = "sha256_from_pass/found_keys_with_balance.txt"

# ⚡ Fulcrum сервер
FULCRUM_HOST = "146.0.73.143"  # IP твоего сервера
FULCRUM_PORT = 50001
BATCH_SIZE = 5000  # Оптимизированный размер батча
THREADS = 10  # Количество потоков
PAUSE_TIME = 0.05  # Минимальная пауза (50 мс)

# 📄 Настройка логирования
LOG_FILE = "sha256_from_pass/fulcrum_checker.log"
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

logging.info("🚀 Запуск скрипта: THREADS=%d, BATCH_SIZE=%d, PAUSE_TIME=%.2f сек", THREADS, BATCH_SIZE, PAUSE_TIME)

# 🔑 Функция конвертации адреса в Scripthash
def address_to_scripthash(address):
    try:
        if address.startswith("1"):  # P2PKH (Legacy)
            decoded = base58.b58decode_check(address)
            script = b'\x76\xa9\x14' + decoded[1:] + b'\x88\xac'
        elif address.startswith("3"):  # P2SH
            decoded = base58.b58decode_check(address)
            script = b'\xa9\x14' + decoded[1:] + b'\x87'
        elif address.startswith("bc1q"):  # P2WPKH (Bech32)
            hrp, data = segwit_addr.decode_segwit_address("bc", address)
            script = bytes([0x00, len(data)]) + bytes(data)
        elif address.startswith("bc1p"):  # P2TR (Taproot, Bech32m)
            hrp, data = segwit_addr.decode_segwit_address("bc", address)
            script = bytes([0x01, len(data)]) + bytes(data)
        else:
            logging.warning("⚠️ Ошибка: Неподдерживаемый формат адреса %s", address)
            return None

        scripthash = hashlib.sha256(script).digest()[::-1].hex()  # SHA256 + little-endian
        return scripthash
    except Exception as e:
        logging.error("⚠️ Ошибка конвертации адреса %s: %s", address, str(e))
        return None

# 🔍 Функция запроса баланса у Fulcrum
def get_balances(scripthashes, address_map):
    if not scripthashes:
        return {}

    requests = [{"jsonrpc": "2.0", "id": i, "method": "blockchain.scripthash.get_balance", "params": [sh]} for i, sh in enumerate(scripthashes)]
    request_json = json.dumps(requests) + "\n"

    try:
        start_time = time.time()
        with socket.create_connection((FULCRUM_HOST, FULCRUM_PORT), timeout=10) as sock:
            sock.sendall(request_json.encode())
            response_data = b""
            while True:
                chunk = sock.recv(1024000)
                if not chunk:
                    break
                response_data += chunk

        results = json.loads(response_data.decode())
        balances = {}
        for res in results:
            if "result" in res:
                scripthash = scripthashes[res["id"]]
                address = address_map[scripthash]
                confirmed = res["result"].get("confirmed", 0)
                unconfirmed = res["result"].get("unconfirmed", 0)
                total_balance = confirmed + unconfirmed
                if total_balance > 0:
                    balances[address] = total_balance

        end_time = time.time()
        logging.info("✅ Получен ответ: %d адресов, время: %.3f сек", len(scripthashes), end_time - start_time)
        return balances

    except socket.timeout:
        logging.error("⏳ Timeout при подключении к Fulcrum!")
    except ConnectionRefusedError:
        logging.error("🚫 Подключение к Fulcrum отклонено!")
    except Exception as e:
        logging.error("❌ Ошибка запроса: %s", str(e))

    return {}

# 🎯 Функция потока для обработки запросов
def worker(task_queue):
    while True:
        try:
            item = task_queue.get()
            if item is None:
                break

            hex_key, addresses = item
            address_map = {}
            scripthashes = []

            for addr in addresses:
                scripthash = address_to_scripthash(addr)
                if scripthash:
                    scripthashes.append(scripthash)
                    address_map[scripthash] = addr

            for i in range(0, len(scripthashes), BATCH_SIZE):
                batch = scripthashes[i:i + BATCH_SIZE]
                balances = get_balances(batch, address_map)

                if balances:
                    with open(OUTPUT_FILE, "a") as outfile:
                        for address, balance in balances.items():
                            outfile.write(f"{hex_key} - {address} - {balance} satoshis\n")

                delay = random.uniform(PAUSE_TIME, PAUSE_TIME * 2)
                logging.info("⏳ Пауза %.3f сек перед следующим запросом...", delay)
                time.sleep(delay)

        except Exception as e:
            logging.error("⚠️ Ошибка в потоке: %s", str(e))
        finally:
            task_queue.task_done()

# 📂 Запуск проверки баланса (по одному файлу за раз)
def check_balances():
    files = [os.path.join(INPUT_FOLDER, f) for f in os.listdir(INPUT_FOLDER) if os.path.isfile(os.path.join(INPUT_FOLDER, f))]

    logging.info("🔍 Начинаем проверку балансов для %d файлов...", len(files))

    for file in files:
        logging.info("📂 Обрабатываю файл: %s", file)

        task_queue = Queue()
        with open(file, "r", encoding="utf-8", errors="ignore") as infile:
            for line in infile:
                parts = line.strip().split(" - ")
                hex_key = parts[0]
                addresses = parts[1:]
                task_queue.put((hex_key, addresses))

        # Запускаем потоки
        threads = []
        for _ in range(THREADS):
            thread = threading.Thread(target=worker, args=(task_queue,))
            thread.start()
            threads.append(thread)

        # Ждем завершения обработки
        task_queue.join()

        # Завершаем потоки
        for _ in range(THREADS):
            task_queue.put(None)
        for thread in threads:
            thread.join()

        logging.info("✅ Обработка файла завершена: %s", file)

    logging.info("✅ Все файлы обработаны. Адреса с балансом записаны в %s", OUTPUT_FILE)

if __name__ == "__main__":
    check_balances()
