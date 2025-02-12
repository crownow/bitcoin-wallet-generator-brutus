const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const dbFile = "wallets.db";

// Получаем список всех файлов `sql_part_*`
const sqlFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.startsWith("sql_part_"))
  .sort(); // Сортируем по алфавиту

if (sqlFiles.length === 0) {
  console.error("❌ Нет файлов для импорта (sql_part_*).");
  process.exit(1);
}

console.log(`✅ Найдено ${sqlFiles.length} SQL-файлов:`);
sqlFiles.forEach((file) => console.log(`   - ${file}`));

// Удаляем старую БД, если она есть
if (fs.existsSync(dbFile)) {
  console.log("🗑 Удаляем старую базу данных...");
  fs.unlinkSync(dbFile);
}

// Открываем новую БД
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка при создании БД:", err);
    process.exit(1);
  }
  console.log("✅ Создана новая база данных.");

  // Создаём таблицу wallets
  db.run(
    `
    CREATE TABLE IF NOT EXISTS wallets (
      address TEXT PRIMARY KEY
    )
  `,
    (err) => {
      if (err) {
        console.error("❌ Ошибка при создании таблицы wallets:", err);
        process.exit(1);
      }
      console.log("✅ Таблица wallets создана.");

      // Запускаем импорт SQL-файлов
      importNextFile();
    }
  );
});

function importNextFile(index = 0) {
  if (index >= sqlFiles.length) {
    console.log("🎉 Импорт всех файлов завершён!");
    db.close();
    return;
  }

  const sqlFile = path.join(__dirname, sqlFiles[index]);
  console.log(`📥 Импортируем файл: ${sqlFile}`);

  const sqliteProcess = spawn("sqlite3", [dbFile]);

  const sqlStream = fs.createReadStream(sqlFile);
  sqlStream.pipe(sqliteProcess.stdin);

  sqliteProcess.on("close", (code) => {
    if (code === 0) {
      console.log(`✅ Файл ${sqlFile} успешно импортирован.`);
      importNextFile(index + 1);
    } else {
      console.error(`❌ Ошибка импорта файла ${sqlFile}. Код выхода: ${code}`);
    }
  });

  sqliteProcess.stderr.on("data", (data) => {
    if (data.includes("database is locked")) {
      console.log("⚠️ База данных заблокирована. Ждём 5 секунд...");
      setTimeout(() => importNextFile(index), 5000);
    } else {
      console.error(`❌ Ошибка SQL (${sqlFile}): ${data}`);
    }
  });
}
