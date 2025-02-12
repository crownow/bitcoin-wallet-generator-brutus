const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { spawn } = require("child_process");

const dbFile = "wallets.db";
const sqlFile = "/root/wallets.sql"; // Убедись, что путь правильный!

// Проверяем, существует ли файл SQL
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

  // Используем spawn вместо exec, чтобы не переполнялся буфер памяти
  const sqliteProcess = spawn("sqlite3", [dbFile]);

  // Читаем SQL-файл построчно и передаем в stdin SQLite
  const sqlStream = fs.createReadStream(sqlFile);
  sqlStream.pipe(sqliteProcess.stdin);

  sqliteProcess.on("close", (code) => {
    if (code === 0) {
      console.log("🎉 Импорт завершён!");
    } else {
      console.error(`❌ Ошибка импорта. Код выхода: ${code}`);
    }
    db.close();
  });

  sqliteProcess.stderr.on("data", (data) => {
    console.error(`❌ Ошибка SQL: ${data}`);
  });

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
  }, 10000); // Обновление каждые 10 сек.
});
