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
const workerpool = require("workerpool");

const { getWalletBalance } = require("./api");
const { processPhrase } = require("./wallet");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("message", "Connected to server");
});

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      console.error("❌ No file uploaded");
      return res.status(400).json({ error: "File not uploaded" });
    }

    const socketId = req.body.socketId;
    console.log("📂 File received:", req.file.originalname);
    console.log("🆔 Socket ID:", socketId);

    res.json({ message: "File upload received, processing started" });

    processFile(req.file.path, socketId);
  } catch (err) {
    console.error("❌ Error in /upload:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function processFile(filePath, socketId) {
  try {
    const limit = pLimit(50);
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

      const task = limit(async () => {
        try {
          const walletData = processPhrase(trimmed);
          const balance = await getWalletBalance(walletData.addresses);
          walletData.balance = balance;

          if (socket) {
            socket.emit("walletFound", walletData);
          }

          processedCount++;
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

    fs.unlink(filePath, (err) => {
      if (err) console.error("❌ Error deleting file:", err);
      else console.log("✅ Uploaded file deleted:", filePath);
    });
  } catch (error) {
    console.error("❌ Error in processFile:", error);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("🚀 Server listening on port " + PORT);
});
