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
  db.run("PRAGMA cache_size = 100000");
  db.run("PRAGMA locking_mode = EXCLUSIVE");
  db.run("PRAGMA temp_store = MEMORY");
  db.run("PRAGMA mmap_size = 3000000000;"); // Ограничение RAM до 3GB
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

      // Фиксируем каждые 500k записей, чтобы не перегружать память
      if (count % 500000 === 0) {
        db.run("COMMIT");
        db.run("BEGIN TRANSACTION");
        console.log(
          `✅ Записано: ${count.toLocaleString()} адресов, COMMIT...`
        );
      }

      // Принудительная очистка памяти каждые 100k записей
      if (count % 100000 === 0) {
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
