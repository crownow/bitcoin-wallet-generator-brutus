require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const readline = require("readline");
const http = require("http");
const { Server } = require("socket.io");
const workerpool = require("workerpool");

const { getWalletBalance } = require("./api");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });
const server = http.createServer(app);
const io = new Server(server);
const pool = workerpool.pool(__dirname + "/workerTask.js", {
  minWorkers: "max",
});

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("message", "Connected to server");
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    console.error("❌ No file uploaded");
    return res.status(400).json({ error: "File not uploaded" });
  }

  const socketId = req.body.socketId;
  console.log("📂 File received:", req.file.originalname);
  console.log("🆔 Socket ID:", socketId);

  res.json({ message: "File upload received, processing started" });

  processFile(req.file.path, socketId);
});

async function processFile(filePath, socketId) {
  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let processedCount = 0;
  let walletFoundCount = 0;
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) console.warn("⚠️ Socket not found for ID:", socketId);

  const tasks = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const task = pool
      .exec("processPhrase", [trimmed])
      .then(async (walletData) => {
        const balance = await getWalletBalance(walletData.addresses);
        walletData.balance = balance;

        if (
          Object.values(balance).some(
            (b) => b.balance > 0 || b.transactions > 0
          )
        ) {
          walletFoundCount++;
          if (socket) {
            socket.emit("walletFound", walletData);
          }
        }

        processedCount++;
        if (processedCount % 1000 === 0 && socket) {
          socket.emit("progress", { processed: processedCount });
        }
      })
      .catch((error) => console.error("❌ Worker error:", error));

    tasks.push(task);
  }

  await Promise.all(tasks);
  pool.terminate(); // Закрываем worker pool после обработки всех данных

  if (socket) {
    socket.emit("complete", {
      totalProcessed: processedCount,
      walletFound: walletFoundCount,
    });
  }

  fs.unlink(filePath, (err) => {
    if (err) console.error("❌ Error deleting file:", err);
    else console.log("✅ Uploaded file deleted:", filePath);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server listening on port " + PORT);
});
