const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("path");
const { Worker } = require("worker_threads");
const { processPhrase } = require("./src/utils/wallet");

const MAX_CONCURRENT_WORKERS = 50; // Увеличиваем до 50 воркеров
let activeWorkers = 0;
let isProcessing = false;
let lastProcessedIndex = 0;
let mainWindow;

app.whenReady().then(() => {
  app.commandLine.appendSwitch("ignore-certificate-errors", "true");
  app.commandLine.appendSwitch("allow-insecure-localhost", "true");
  app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
  app.commandLine.appendSwitch("disable-http-cache");
  app.commandLine.appendSwitch("disable-web-security");
  app.commandLine.appendSwitch("ignore-certificate-errors-spki-list");
  app.commandLine.appendSwitch("allow-running-insecure-content", "true");

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");
});

ipcMain.on("process-keywords", async (event, phrases) => {
  console.log(`🔹 Получено ${phrases.length} фраз`);

  isProcessing = true;
  lastProcessedIndex = 0;
  const CHUNK_SIZE = 1000;
  let results = [];

  for (let i = lastProcessedIndex; i < phrases.length; i += CHUNK_SIZE) {
    if (!isProcessing) break; // Остановка обработки

    let chunk = phrases.slice(i, i + CHUNK_SIZE);
    console.log(
      `🔹 Обрабатываем блок ${i / CHUNK_SIZE + 1} из ${Math.ceil(
        phrases.length / CHUNK_SIZE
      )}`
    );

    let wallets = chunk.map(processPhrase);
    const workerPromises = [];

    for (const wallet of wallets) {
      while (activeWorkers >= MAX_CONCURRENT_WORKERS) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!isProcessing) break;

      activeWorkers++;

      workerPromises.push(
        new Promise((resolve, reject) => {
          const worker = new Worker(
            path.join(__dirname, "src/utils/worker.js"),
            { workerData: wallet }
          );

          worker.on("message", (result) => {
            activeWorkers--;
            resolve(result);
          });

          worker.on("error", (err) => {
            activeWorkers--;
            reject(err);
          });
        })
      );
    }

    results.push(...(await Promise.all(workerPromises)));
    lastProcessedIndex = i + CHUNK_SIZE;
  }

  results = results.filter(
    (wallet) => wallet.balance > 1 || wallet.transactions > 1
  );
  console.log(`✅ Обработано ${results.length} кошельков`);
  event.reply("wallet-data", results);
});

ipcMain.on("stop-processing", (event) => {
  isProcessing = false;
  console.log("⏹ Остановка обработки");
});

ipcMain.on("resume-processing", (event, phrases) => {
  if (!isProcessing) {
    console.log("▶️ Продолжаем обработку с индекса", lastProcessedIndex);
    ipcMain.emit("process-keywords", event, phrases.slice(lastProcessedIndex));
  }
});
