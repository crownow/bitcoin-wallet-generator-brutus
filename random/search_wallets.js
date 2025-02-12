const sqlite3 = require("sqlite3").verbose();
const { Worker, isMainThread, parentPort } = require("worker_threads");
const os = require("os");
const fs = require("fs");

// Открываем базу
const db = new sqlite3.Database("wallets.db");

// Файл для найденных ключей
const foundKeysFile = "founded_hex.txt";

// Количество воркеров (по количеству ядер CPU)
const numWorkers = os.cpus().length;

if (isMainThread) {
  console.log(`🚀 Запускаем ${numWorkers} воркеров...`);

  // Загружаем адреса из базы в Set для быстрой проверки
  db.all("SELECT address FROM wallets", [], (err, rows) => {
    if (err) {
      console.error("❌ Ошибка загрузки адресов:", err);
      process.exit(1);
    }

    const walletsSet = new Set(rows.map((row) => row.address));
    console.log(`✅ Загружено ${walletsSet.size} кошельков в память.`);

    // Запускаем воркеров
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(__dirname + "/worker.js", {
        workerData: Array.from(walletsSet), // Передаём список адресов воркеру
      });

      console.log(`🔹 Воркер ${worker.threadId} запущен.`);

      worker.on("message", (privateKey) => {
        console.log(
          `🎯 НАЙДЕН КЛЮЧ (Воркер ${worker.threadId}): ${privateKey}`
        );
        fs.appendFileSync(foundKeysFile, `${privateKey}\n`);
      });

      worker.on("error", (err) => {
        console.error(`❌ Ошибка в воркере ${worker.threadId}:`, err);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          console.error(
            `❌ Воркер ${worker.threadId} завершился с кодом ${code}`
          );
        } else {
          console.log(`✅ Воркер ${worker.threadId} завершил работу.`);
        }
      });
    }
  });
} else {
  console.log(`❌ Этот файл должен запускаться как главный процесс.`);
}
