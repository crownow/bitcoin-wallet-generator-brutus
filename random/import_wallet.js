const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { exec } = require("child_process");

const dbFile = "wallets.db";
const sqlFile = "/root/wallets.sql"; // Путь к SQL-файлу

// Проверяем, существует ли файл
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

  // Запускаем импорт SQL-файла в базу
  console.log("⏳ Начинаем импорт SQL-файла в базу...");

  exec(`sqlite3 ${dbFile} < ${sqlFile}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Ошибка выполнения SQL-файла: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Ошибка SQL: ${stderr}`);
    }
    console.log("🎉 Импорт завершён!");
    db.close();
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
  }, 10000); // Запрашиваем каждые 10 секунд
});
