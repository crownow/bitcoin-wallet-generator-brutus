// server/server.js
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const http = require("http");
const { Server } = require("socket.io");
const pLimit = require("p-limit");
const cluster = require("cluster");
const os = require("os");
const client = require("prom-client");

// Импортируем API (с кэшированием)
const { getWalletBalance } = require("./api");

// Настраиваем Prometheus: сбор дефолтных метрик
client.collectDefaultMetrics();
// Создаём кастомные метрики
const processedCounter = new client.Counter({
  name: "processed_lines_total",
  help: "Total number of processed lines",
});
const walletFoundCounter = new client.Counter({
  name: "wallets_found_total",
  help: "Total number of wallets with funds found",
});

if (cluster.isMaster) {
  // Мастер-процесс: форкаем рабочих (по числу ядер CPU)
  const numCPUs = os.cpus().length;
  console.log(`Master process ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // Рабочий процесс: запускаем сервер
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const PORT = process.env.PORT || 3000;

  // Создаём пул воркеров для CPU‑интенсивной обработки (workerpool)
  const workerpool = require("workerpool");
  const pool = workerpool.pool(path.join(__dirname, "workerTask.js"), {
    maxWorkers: os.cpus().length,
  });

  // Настройка express для парсинга form-data
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Эндпоинт для мониторинга (Prometheus)
  app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  });

  // Socket.io: обработка подключений клиентов
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.emit("message", "Connected to server");
  });

  // Настройка multer для загрузки файлов
  const upload = multer({ dest: "uploads/" });

  // Эндпоинт загрузки файла
  app.post("/upload", upload.single("file"), async (req, res) => {
    const socketId = req.body.socketId; // socketId передаётся из клиента
    if (!req.file) {
      return res.status(400).json({ error: "File not uploaded" });
    }
    // Отвечаем клиенту сразу, чтобы не ждать завершения обработки
    res.json({ message: "File upload received, processing started" });
    processFile(req.file.path, socketId);
  });

  // Функция потоковой обработки файла
  async function processFile(filePath, socketId) {
    const limit = pLimit(50); // Ограничение одновременных задач
    const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let processedCount = 0;
    let walletFoundCount = 0;
    // Получаем клиентский сокет по socketId (если он ещё подключён)
    const socket = io.sockets.sockets.get(socketId);

    const tasks = [];

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const task = limit(async () => {
        // Передаём CPU‑интенсивную обработку в пул воркеров
        const walletData = await pool.exec("processPhrase", [trimmed]);
        // Выполняем сетевую часть (запрос баланса) в основном потоке
        const balance = await getWalletBalance(walletData.addresses);
        walletData.balance = balance;

        // Увеличиваем счётчик обработанных строк
        processedCounter.inc();

        // Проверяем, есть ли средства/транзакции
        let hasFunds = false;
        for (const key in balance) {
          if (
            balance[key] &&
            (balance[key].balance > 0 || balance[key].transactions > 0)
          ) {
            hasFunds = true;
            break;
          }
        }

        if (hasFunds) {
          walletFoundCount++;
          walletFoundCounter.inc();
          if (socket) {
            socket.emit("walletFound", walletData);
          }
        }

        processedCount++;
        // Каждые 1000 строк отправляем обновление прогресса с количеством обработанных строк
        if (processedCount % 1000 === 0 && socket) {
          socket.emit("progress", { processed: processedCount });
        }
      });
      tasks.push(task);
    }

    await Promise.all(tasks);

    if (socket) {
      socket.emit("complete", {
        totalProcessed: processedCount,
        walletFound: walletFoundCount,
      });
    }

    // Удаляем временный файл после обработки
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log("Uploaded file deleted:", filePath);
    });
  }

  server.listen(PORT, () =>
    console.log(`Worker ${process.pid}: API server listening on port ${PORT}`)
  );
}
