// renderer.js
document.addEventListener("DOMContentLoaded", () => {
  const processBtn = document.getElementById("processBtn");
  const clearBtn = document.getElementById("clearBtn");
  const fileInput = document.getElementById("fileInput");
  const resultsTableBody = document.querySelector("#resultsTable tbody");
  const processedLinesElement = document.getElementById("processedLines");
  const progressBarContainer = document.getElementById("progressBarContainer");
  const progressBar = document.getElementById("progressBar");
  const alertContainer = document.getElementById("alertContainer");
  const loaderOverlay = document.getElementById("loaderOverlay");

  // Функция для показа уведомлений с эффектом исчезновения
  function showAlert(message, type = "info", timeout = 5000) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = "alert";
    alertDiv.innerHTML = message;
    alertDiv.innerHTML += `<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    alertContainer.appendChild(alertDiv);
    if (timeout) {
      setTimeout(() => {
        alertDiv.classList.remove("show");
        alertDiv.classList.add("hide");
        setTimeout(() => {
          alertDiv.remove();
        }, 500);
      }, timeout);
    }
  }

  // Подключаемся к серверу через Socket.io
  const socket = io("http://localhost:3000");

  socket.on("connect", () => {
    console.log("Connected via socket.io, socket id:", socket.id);
    showAlert("Connected to server.", "success", 3000);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server.");
    showAlert("Disconnected from server.", "warning", 3000);
  });

  socket.on("message", (msg) => {
    console.log("Server message:", msg);
  });

  socket.on("progress", (data) => {
    processedLinesElement.textContent = data.processed;
    // Обновляем прогресс-бар (ориентировочно, с общим числом строк 15 000 000)
    const total = 15000000;
    const percent = Math.min(100, (data.processed / total) * 100).toFixed(1);
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", percent);
    progressBar.textContent = `${percent}%`;
    progressBarContainer.style.display = "block";
  });

  socket.on("walletFound", (wallet) => {
    // Добавляем строку с данными кошелька в таблицу
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
    resultsTableBody.appendChild(row);
  });

  socket.on("complete", (data) => {
    console.log("Processing complete:", data);
    loaderOverlay.style.display = "none";
    processBtn.disabled = false;
    progressBarContainer.style.display = "none";
    showAlert(
      `Processing complete. Total processed: ${data.totalProcessed}, Wallets found: ${data.walletFound}`,
      "success",
      7000
    );
  });

  processBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      showAlert("Please select a file.", "danger");
      return;
    }

    // Очищаем предыдущие уведомления и результаты
    alertContainer.innerHTML = "";
    resultsTableBody.innerHTML = "";
    processedLinesElement.textContent = "0";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    progressBarContainer.style.display = "block";

    // Показываем loader overlay
    loaderOverlay.style.display = "flex";
    processBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("socketId", socket.id);

      const response = await fetch("http://localhost:3000/upload", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      console.log("Upload response:", result);
      showAlert("File uploaded successfully. Processing started.", "info");
    } catch (err) {
      console.error("Upload error:", err);
      loaderOverlay.style.display = "none";
      processBtn.disabled = false;
      showAlert("Error uploading file.", "danger");
    }
  });

  // Кнопка для очистки результатов
  clearBtn.addEventListener("click", () => {
    resultsTableBody.innerHTML = "";
  });
});
