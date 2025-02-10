// server/server.js
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const http = require("http");
const sticky = require("sticky-session"); // Новый модуль для sticky sessions
const { Server } = require("socket.io");
const pLimit = require("p-limit");
const os = require("os");
const client = require("prom-client");
const workerpool = require("workerpool");

// Импортируем API (с кэшированием)
const { getWalletBalance } = require("./api");

// Настройка Prometheus: сбор дефолтных метрик
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

// Создаём Express-приложение
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Эндпоинт для мониторинга (Prometheus)
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
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
      // Передаём CPU-интенсивную обработку в пул воркеров
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
      // Каждые 1000 строк отправляем обновление прогресса
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

// Создаем HTTP-сервер из Express-приложения
const server = http.createServer(app);

// Создаем экземпляр Socket.IO
const io = new Server(server);
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("message", "Connected to server");
});

// Создаем пул воркеров для CPU-интенсивной обработки (workerpool)
const pool = workerpool.pool(path.join(__dirname, "workerTask.js"), {
  maxWorkers: os.cpus().length,
});

// Используем sticky-session для запуска сервера с sticky sessions
const PORT = process.env.PORT || 3000;
if (!sticky.listen(server, PORT)) {
  // Это мастер-процесс sticky-session; он не обрабатывает HTTP-запросы.
  console.log("Master process " + process.pid + " is running");
  process.exit();
} else {
  // Это рабочий процесс; он обрабатывает подключения.
  console.log("Worker " + process.pid + " is listening on port " + PORT);
}
