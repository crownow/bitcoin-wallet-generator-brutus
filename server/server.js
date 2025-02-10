require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const http = require("http");
const { Server } = require("socket.io");
const pLimit = require("p-limit");
const os = require("os");
const client = require("prom-client");
const workerpool = require("workerpool");

// Импортируем API (с кэшированием)
const { getWalletBalance } = require("./api");

// Настройка Prometheus: сбор дефолтных метрик
client.collectDefaultMetrics();
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

// Создаём HTTP-сервер и экземпляр Socket.IO
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("message", "Connected to server");
});

// Эндпоинт загрузки файла
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file uploaded");
      return res.status(400).json({ error: "File not uploaded" });
    }

    const socketId = req.body.socketId;
    console.log("📂 File received:", req.file.originalname);
    console.log("🆔 Socket ID:", socketId);

    // Отвечаем клиенту сразу, чтобы не зависал `fetch`
    res.json({ message: "File upload received, processing started" });

    // Запускаем обработку файла в фоне
    processFile(req.file.path, socketId);
  } catch (err) {
    console.error("❌ Error in /upload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Функция потоковой обработки файла
async function processFile(filePath, socketId) {
  try {
    const limit = pLimit(50); // Ограничение одновременных задач
    const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let processedCount = 0;
    let walletFoundCount = 0;

    // Получаем клиентский сокет по socketId
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      console.warn("⚠️ Socket not found for ID:", socketId);
    }

    const tasks = [];

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const task = limit(async () => {
        try {
          // Передаём CPU-интенсивную обработку в пул воркеров
          const walletData = await pool.exec("processPhrase", [trimmed]);

          // Запрос баланса
          const balance = await getWalletBalance(walletData.addresses);
          walletData.balance = balance;

          // Увеличиваем счётчик обработанных строк
          processedCounter.inc();

          // Проверяем, есть ли средства/транзакции
          let hasFunds = Object.values(balance).some(
            (data) => data && (data.balance > 0 || data.transactions > 0)
          );

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
        } catch (error) {
          console.error("❌ Error processing line:", error);
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
      if (err) console.error("❌ Error deleting file:", err);
      else console.log("✅ Uploaded file deleted:", filePath);
    });
  } catch (error) {
    console.error("❌ Error in processFile:", error);
  }
}

// Создаём пул воркеров для CPU-интенсивной обработки (workerpool)
const pool = workerpool.pool(path.join(__dirname, "./workerTask.js"), {
  maxWorkers: os.cpus().length,
});

const PORT = process.env.PORT || 3000;

// Запускаем сервер
server.listen(PORT, () => {
  console.log("🚀 Server listening on port " + PORT);
});
