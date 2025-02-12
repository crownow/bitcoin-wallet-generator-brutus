const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const readline = require("readline");

const walletsFile = "/home/bitcoin_addresses_latest2.tsv";
const dbFile = "wallets.db";

// Открываем SQLite базу
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");
});

// Оптимизация SQLite
db.serialize(() => {
  db.run("PRAGMA journal_mode = OFF");
  db.run("PRAGMA synchronous = OFF");
  db.run("PRAGMA cache_size = -2000000;"); // Ограничиваем кеш SQLite (2GB)
  db.run("PRAGMA mmap_size = 2147483648;"); // Ограничиваем использование памяти SQLite (2GB)
  db.run("PRAGMA temp_store = MEMORY;");
});

// Проверяем, существует ли файл
if (!fs.existsSync(walletsFile)) {
  console.error(`❌ Файл ${walletsFile} не найден!`);
  process.exit(1);
}

// Функция импорта кошельков
async function importWallets() {
  console.log("⏳ Импортируем кошельки в SQLite...");

  const fileStream = fs.createReadStream(walletsFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let count = 0;
  db.run("BEGIN TRANSACTION"); // Начинаем транзакцию

  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO wallets (address) VALUES (?)"
  );

  try {
    for await (const line of rl) {
      const address = line.trim();
      if (!address) continue;

      insertStmt.run(address, (err) => {
        if (err) console.error("❌ Ошибка вставки:", err);
      });

      count++;

      // Фиксируем каждые 100,000 записей
      if (count % 100000 === 0) {
        db.run("COMMIT", () => {
          db.run("BEGIN TRANSACTION");
          console.log(
            `✅ Записано: ${count.toLocaleString()} адресов, COMMIT...`
          );
        });
      }

      // Принудительная очистка памяти каждые 50,000 записей
      if (count % 50000 === 0 && global.gc) {
        global.gc();
      }
    }
  } catch (err) {
    console.error("❌ Ошибка при чтении файла:", err);
  }

  insertStmt.finalize((err) => {
    if (err) console.error("❌ Ошибка при закрытии prepared statement:", err);

    db.run("COMMIT", () => {
      // Завершаем транзакцию
      console.log("🎉 Импорт завершён!");

      db.run(
        "CREATE INDEX IF NOT EXISTS idx_wallets ON wallets (address)",
        (err) => {
          if (err) console.error("❌ Ошибка при создании индекса:", err);
          else console.log("🚀 Индекс создан! Теперь поиск будет мгновенным.");
          db.close();
        }
      );
    });
  });
}

// Запускаем импорт
importWallets();
