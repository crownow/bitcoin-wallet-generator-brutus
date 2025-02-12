const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { spawn } = require("child_process");

const dbFile = "wallets.db";
const sqlFile = "/root/wallets.sql"; // Убедись, что путь правильный!

if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Файл ${sqlFile} не найден!`);
  process.exit(1);
}

// Открываем SQLite базу
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");

  console.log("⏳ Начинаем импорт SQL-файла в базу...");

  function runImport(attempt = 1) {
    const sqliteProcess = spawn("sqlite3", [dbFile]);

    // Читаем SQL-файл построчно и передаем в stdin SQLite
    const sqlStream = fs.createReadStream(sqlFile);
    sqlStream.pipe(sqliteProcess.stdin);

    sqliteProcess.on("close", (code) => {
      if (code === 0) {
        console.log("🎉 Импорт завершён!");
        db.close();
      } else {
        console.error(`❌ Ошибка импорта. Код выхода: ${code}`);
        if (attempt < 5) {
          console.log(`🔄 Попытка ${attempt + 1} через 5 секунд...`);
          setTimeout(() => runImport(attempt + 1), 5000);
        } else {
          console.log("❌ Не удалось импортировать данные после 5 попыток.");
        }
      }
    });

    sqliteProcess.stderr.on("data", (data) => {
      if (data.includes("database is locked")) {
        console.log("⚠️ База данных заблокирована. Ждем...");
        setTimeout(() => runImport(attempt + 1), 5000);
      } else {
        console.error(`❌ Ошибка SQL: ${data}`);
      }
    });
  }

  runImport();

  // Выводим количество записей каждые 10 секунд
  setInterval(() => {
    db.get("SELECT COUNT(*) as count FROM wallets", (err, row) => {
      if (err) {
        console.error("❌ Ошибка при запросе количества записей:", err);
      } else {
        console.log(
          `📊 Текущее количество записей: ${row.count.toLocaleString()}`
        );
      }
    });
  }, 10000);
});
