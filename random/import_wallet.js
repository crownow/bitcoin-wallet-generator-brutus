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
});

// Создаём таблицу, если её нет
db.run("CREATE TABLE IF NOT EXISTS wallets (address TEXT UNIQUE)", (err) => {
  if (err) {
    console.error("❌ Ошибка при создании таблицы:", err);
    process.exit(1);
  }

  console.log("⏳ Начинаем импорт SQL-файла в базу...");

  // Выполняем импорт SQL-файла в SQLite
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
});
