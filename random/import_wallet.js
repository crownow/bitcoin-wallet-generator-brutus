const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const readline = require("readline");

// Пути к файлам
const walletsFile = "/home/bitcoin_addresses_latest2.tsv";
const dbFile = "wallets.db";

// Открываем базу данных
const db = new sqlite3.Database(dbFile);

// Создаём таблицу (если её нет)
db.serialize(() => {
  db.run("DROP TABLE IF EXISTS wallets");
  db.run("CREATE TABLE wallets (address TEXT PRIMARY KEY)");
  db.run("PRAGMA synchronous = OFF"); // Ускоряет вставку
  db.run("PRAGMA journal_mode = MEMORY"); // Уменьшает нагрузку на диск
});

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
    insertStmt.run(line.trim());
    count++;

    if (count % 100000 === 0) {
      console.log(`✅ Загружено: ${count} адресов...`);
    }
  }

  insertStmt.finalize(() => {
    console.log("🎉 Импорт завершён!");
    db.run("CREATE INDEX idx_wallets ON wallets (address)", () => {
      console.log("🚀 Индекс создан! Теперь поиск будет мгновенным.");
      db.close();
    });
  });
}

importWallets();
