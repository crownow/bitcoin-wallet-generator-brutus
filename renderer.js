const processBtn = document.getElementById("processBtn");
const stopBtn = document.getElementById("stopBtn");
const continueBtn = document.getElementById("continueBtn");
const processedLinesElement = document.getElementById("processedLines"); // ✅ Counter element

let isProcessing = false;
let lastProcessedIndex = 0;
let phrases = [];
let processedLines = 0; // ✅ Counter for processed lines
const CHUNK_SIZE = 512 * 1024; // 512KB instead of 1MB
const MAX_PHRASES_BATCH = 500; // Limit batch size
let lastChunk = ""; // Buffer for incomplete lines

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
  lastChunk = ""; // Clear buffer
  processedLines = 0; // ✅ Reset counter

  function processChunk(chunk) {
    const fullData = lastChunk + chunk;
    const lines = fullData.split("\n");

    lastChunk = lines.pop() || ""; // Save incomplete line for next chunk

    phrases.push(...lines);
    processedLines += lines.length; // ✅ Increment counter

    // ✅ Update the UI counter in real-time
    processedLinesElement.textContent = processedLines;

    if (phrases.length >= MAX_PHRASES_BATCH) {
      window.electron.send("process-keywords", phrases);
      phrases = [];

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }

  function readNextChunk(offset) {
    if (!isProcessing) return;

    const reader = new FileReader();

    reader.onload = function (event) {
      processChunk(event.target.result);

      offset += CHUNK_SIZE;
      lastProcessedIndex = offset;

      if (offset < fileInput.size) {
        setTimeout(() => readNextChunk(offset), 0);
      } else {
        if (phrases.length > 0) {
          window.electron.send("process-keywords", phrases);
        }
        stopBtn.disabled = true;
        document.getElementById("loader").style.display = "none";
      }
    };

    reader.onerror = function (error) {
      console.error("❌ File read error:", error);
      document.getElementById("loader").style.display = "none";
    };

    const slice = fileInput.slice(offset, offset + CHUNK_SIZE);
    reader.readAsText(slice, "ISO-8859-1");
  }

  readNextChunk(0);
});

// 📩 Receive processed wallet data
window.electron.receive("wallet-data", (wallets) => {
  document.getElementById("loader").style.display = "none";
  processBtn.disabled = false;
  stopBtn.disabled = true;
  continueBtn.disabled = false;

  const tableBody = document.querySelector("#resultsTable tbody");
  tableBody.innerHTML = "";

  console.log("📩 Received wallet data:", wallets);

  const filteredWallets = wallets.filter((wallet) =>
    Object.values(wallet.balance).some(
      (entry) => entry.balance > 0 || entry.transactions > 0
    )
  );

  console.log("✅ Filtered wallets:", filteredWallets);

  if (filteredWallets.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="7" style="text-align: center;">No wallets with balance or transactions found</td>`;
    tableBody.appendChild(row);
    return;
  }

  filteredWallets.forEach((wallet) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${wallet.privateKeyHex || "Error"}</td>
      <td>${wallet.addresses.p2pkh || "Error"}</td>
      <td>${wallet.addresses.p2sh || "Error"}</td>
      <td>${wallet.addresses.p2wpkh || "Error"}</td>
      <td>${wallet.addresses.p2tr || "Error"}</td>
      <td>${wallet.balance.p2pkh?.balance || 0}</td>
      <td>${wallet.balance.p2pkh?.transactions || 0}</td>
    `;

    tableBody.appendChild(row);
  });
});

// 🔴 Stop Button - Stops processing
stopBtn.addEventListener("click", () => {
  isProcessing = false;
  stopBtn.disabled = true;
  continueBtn.disabled = false;
  window.electron.send("stop-processing");
  console.log("⏹ Processing stopped");
});

// ▶️ Continue Button - Resumes processing from last position
continueBtn.addEventListener("click", () => {
  if (!isProcessing) {
    console.log("▶️ Resuming from index", lastProcessedIndex);
    document.getElementById("loader").style.display = "block";
    processBtn.disabled = true;
    stopBtn.disabled = false;
    continueBtn.disabled = true;

    isProcessing = true;
    readNextChunk(lastProcessedIndex);
  }
});
