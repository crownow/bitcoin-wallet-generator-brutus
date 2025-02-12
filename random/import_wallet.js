const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const dbFile = "wallets.db";

// Получаем список всех файлов с именем, начинающимся на `sql_part_`
const sqlFiles = fs
  .readdirSync(__dirname)
  .filter((file) => file.startsWith("sql_part_")) // Фильтруем файлы по имени
  .sort(); // Сортируем, чтобы загружались в порядке

if (sqlFiles.length === 0) {
  console.error("❌ Нет файлов для импорта (sql_part_*).");
  process.exit(1);
}

console.log(`✅ Найдено ${sqlFiles.length} файлов SQL:`);
sqlFiles.forEach((file) => console.log(`   - ${file}`));

// Удаляем старую БД, если она есть
if (fs.existsSync(dbFile)) {
  console.log("🗑 Удаляем старую базу данных...");
  fs.unlinkSync(dbFile);
}

// Открываем SQLite базу
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("❌ Ошибка подключения к базе:", err);
    process.exit(1);
  }
  console.log("✅ Подключение к базе установлено.");
  console.log("⏳ Начинаем импорт SQL-файлов...");

  function importNextFile(index = 0) {
    if (index >= sqlFiles.length) {
      console.log("🎉 Импорт всех файлов завершён!");
      db.close();
      return;
    }

    const sqlFile = path.join(__dirname, sqlFiles[index]);
    console.log(`📥 Импортируем файл: ${sqlFile}`);

    const sqliteProcess = spawn("sqlite3", [dbFile]);

    // Читаем SQL-файл построчно и передаем в stdin SQLite
    const sqlStream = fs.createReadStream(sqlFile);
    sqlStream.pipe(sqliteProcess.stdin);

    sqliteProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Файл ${sqlFile} успешно импортирован.`);
        importNextFile(index + 1); // Импортируем следующий файл
      } else {
        console.error(
          `❌ Ошибка импорта файла ${sqlFile}. Код выхода: ${code}`
        );
      }
    });

    sqliteProcess.stderr.on("data", (data) => {
      if (data.includes("database is locked")) {
        console.log("⚠️ База данных заблокирована. Ждем 5 секунд...");
        setTimeout(() => importNextFile(index), 5000);
      } else {
        console.error(`❌ Ошибка SQL (${sqlFile}): ${data}`);
      }
    });
  }

  importNextFile();

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
