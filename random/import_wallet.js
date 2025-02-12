const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const readline = require("readline");

const walletsFile = "/home/bitcoin_addresses_latest2.tsv";
const dbFile = "wallets.db";

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");
});

db.serialize(() => {
  db.run("PRAGMA journal_mode = MEMORY");
  db.run("PRAGMA synchronous = OFF");
  db.run("PRAGMA cache_size = 100000");
  db.run("PRAGMA max_page_count = 2147483646");
});

// Проверяем, есть ли файл
if (!fs.existsSync(walletsFile)) {
  console.error(`❌ Файл ${walletsFile} не найден!`);
  process.exit(1);
}

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

  try {
    for await (const line of rl) {
      const address = line.trim();
      if (!address) continue;

      insertStmt.run(address, (err) => {
        if (err) console.error("❌ Ошибка вставки:", err);
      });

      count++;

      if (count % 100000 === 0) {
        console.log(`✅ Загружено: ${count.toLocaleString()} адресов...`);
      }
    }
  } catch (err) {
    console.error("❌ Ошибка при чтении файла:", err);
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

importWallets();
