const processBtn = document.getElementById("processBtn");
const stopBtn = document.getElementById("stopBtn");
const continueBtn = document.getElementById("continueBtn");

let isProcessing = false;
let lastProcessedIndex = 0;
let phrases = [];
const CHUNK_SIZE = 1024 * 1024; // 1MB чанки

processBtn.addEventListener("click", async () => {
  const fileInput = document.getElementById("fileInput").files[0];

  if (!fileInput) {
    alert("Please upload a file containing keyword phrases.");
    return;
  }

  document.getElementById("loader").style.display = "block";
  processBtn.disabled = true;
  stopBtn.disabled = false;
  continueBtn.disabled = true;

  isProcessing = true;
  lastProcessedIndex = 0;
  phrases = [];

  function processChunk(chunk) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    phrases.push(...lines);

    if (phrases.length >= 1000) {
      window.electron.send("process-keywords", phrases);
      phrases = [];
    }
  }

  function readNextChunk(offset) {
    if (!isProcessing) return; // Прекращаем обработку, если нажата "Стоп"

    const reader = new FileReader();

    reader.onload = function (event) {
      processChunk(event.target.result);

      offset += CHUNK_SIZE;
      lastProcessedIndex = offset; // Запоминаем место остановки

      if (offset < fileInput.size) {
        readNextChunk(offset);
      } else {
        if (phrases.length > 0) {
          window.electron.send("process-keywords", phrases);
        }
        stopBtn.disabled = true;
      }
    };

    reader.onerror = function (error) {
      console.error("❌ Ошибка чтения файла:", error);
      document.getElementById("loader").style.display = "none";
    };

    const slice = fileInput.slice(offset, offset + CHUNK_SIZE);
    reader.readAsText(slice);
  }

  readNextChunk(0);
});

// 📩 Получаем обработанные данные
window.electron.receive("wallet-data", (wallets) => {
  document.getElementById("loader").style.display = "none";
  processBtn.disabled = false;
  stopBtn.disabled = true;
  continueBtn.disabled = false;

  const tableBody = document.querySelector("#resultsTable tbody");
  tableBody.innerHTML = "";

  console.log("📩 Получены данные кошельков:", wallets);

  const filteredWallets = wallets.filter((wallet) =>
    Object.values(wallet.balance).some(
      (entry) => entry.balance > 0 || entry.transactions > 0
    )
  );

  console.log("✅ Отфильтрованные кошельки:", filteredWallets);

  if (filteredWallets.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7" style="text-align: center;">Нет кошельков с балансом или транзакциями</td>`;
    tableBody.appendChild(row);
    return;
  }

  filteredWallets.forEach((wallet) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${wallet.privateKeyHex || "Ошибка"}</td>
      <td>${wallet.addresses.p2pkh || "Ошибка"}</td>
      <td>${wallet.addresses.p2sh || "Ошибка"}</td>
      <td>${wallet.addresses.p2wpkh || "Ошибка"}</td>
      <td>${wallet.addresses.p2tr || "Ошибка"}</td>
      <td>${wallet.balance.p2pkh?.balance || 0}</td>
      <td>${wallet.balance.p2pkh?.transactions || 0}</td>
    `;

    tableBody.appendChild(row);
  });
});

// 🔴 Кнопка "Стоп" - Останавливает процесс
stopBtn.addEventListener("click", () => {
  isProcessing = false;
  stopBtn.disabled = true;
  continueBtn.disabled = false;
  window.electron.send("stop-processing");
  console.log("⏹ Остановка обработки");
});

// ▶️ Кнопка "Продолжить" - Возобновляет процесс с места остановки
continueBtn.addEventListener("click", () => {
  if (!isProcessing) {
    console.log("▶️ Продолжаем обработку с индекса", lastProcessedIndex);
    document.getElementById("loader").style.display = "block";
    processBtn.disabled = true;
    stopBtn.disabled = false;
    continueBtn.disabled = true;

    isProcessing = true;
    readNextChunk(lastProcessedIndex);
  }
});
