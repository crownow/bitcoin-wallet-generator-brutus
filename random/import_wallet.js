const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const readline = require("readline");

// Пути к файлам
const walletsFile = "/home/bitcoin_addresses_latest2.tsv";
const dbFile = "wallets.db";

// Открываем базу данных
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");
});

// Создаём таблицу (если её нет)
db.serialize(() => {
  console.log("📌 Пересоздаём таблицу wallets...");
  db.run("DROP TABLE IF EXISTS wallets", (err) => {
    if (err) console.error("❌ Ошибка при удалении таблицы:", err);
  });

  db.run("CREATE TABLE wallets (address TEXT PRIMARY KEY)", (err) => {
    if (err) console.error("❌ Ошибка при создании таблицы:", err);
  });

  db.run("PRAGMA synchronous = OFF");
  db.run("PRAGMA journal_mode = MEMORY");
});

// Проверяем, существует ли файл
if (!fs.existsSync(walletsFile)) {
  console.error(`❌ Файл ${walletsFile} не найден!`);
  process.exit(1);
}

// Функция для импорта данных
async function importWallets() {
  console.log("⏳ Импортируем кошельки в SQLite...");

  const fileStream = fs.createReadStream(walletsFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let count = 0;
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO wallets (address) VALUES (?)"
  );

  for await (const line of rl) {
    const address = line.trim();

    if (!address) {
      console.warn("⚠️ Пустая строка, пропускаем...");
      continue;
    }

    insertStmt.run(address, (err) => {
      if (err) console.error("❌ Ошибка вставки:", err);
    });

    count++;

    if (count % 100000 === 0) {
      console.log(`✅ Загружено: ${count.toLocaleString()} адресов...`);
    }
  }

  insertStmt.finalize((err) => {
    if (err) console.error("❌ Ошибка при закрытии prepared statement:", err);
    console.log("🎉 Импорт завершён!");

    db.run("CREATE INDEX idx_wallets ON wallets (address)", (err) => {
      if (err) console.error("❌ Ошибка при создании индекса:", err);
      else console.log("🚀 Индекс создан! Теперь поиск будет мгновенным.");
      db.close();
    });
  });
}

// Запускаем импорт
importWallets();
