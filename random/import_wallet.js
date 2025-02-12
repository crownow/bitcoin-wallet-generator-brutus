const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const readline = require("readline");

const walletsFile = "/home/bitcoin_addresses_latest2.tsv";
const dbFile = "wallets.db";
const BATCH_SIZE = 1_000_000; // Размер порции (1 миллион записей)

// Открываем SQLite базу
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");
});

// Создаём таблицу, если её нет
db.run("CREATE TABLE IF NOT EXISTS wallets (address TEXT UNIQUE)");

// Проверяем, существует ли файл
if (!fs.existsSync(walletsFile)) {
  console.error(`❌ Файл ${walletsFile} не найден!`);
  process.exit(1);
}

// Функция импорта кошельков
async function importWallets() {
  console.log("⏳ Начинаем импорт кошельков в SQLite...");

  const fileStream = fs.createReadStream(walletsFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let batch = [];
  let count = 0;

  try {
    for await (const line of rl) {
      const address = line.trim();
      if (!address) continue;

      batch.push(address);
      count++;

      // Когда набрался 1 миллион записей – записываем их в базу
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(batch);
        console.log(`✅ Загружено: ${count.toLocaleString()} адресов`);
        batch = []; // Очищаем буфер
      }
    }

    // Вставляем оставшиеся записи, если они есть
    if (batch.length > 0) {
      await insertBatch(batch);
    }

    console.log("🎉 Импорт завершён!");
  } catch (err) {
    console.error("❌ Ошибка при чтении файла:", err);
  } finally {
    db.close();
  }
}

// Функция для массовой вставки данных
function insertBatch(batch) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      const stmt = db.prepare(
        "INSERT OR IGNORE INTO wallets (address) VALUES (?)"
      );

      for (const address of batch) {
        stmt.run(address);
      }

      stmt.finalize((err) => {
        if (err) {
          console.error("❌ Ошибка вставки данных:", err);
          reject(err);
        } else {
          db.run("COMMIT", resolve);
        }
      });
    });
  });
}

// Запускаем импорт
importWallets();
