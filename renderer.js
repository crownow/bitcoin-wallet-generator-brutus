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

  function showLoader(text = "Processing...") {
    console.log(`🔄 Showing loader: ${text}`);
    const loader = document.getElementById("loaderOverlay");
    loader.classList.add("d-flex", "fade"); // Гарантированно показываем
    loader.style.display = "flex";
    loader.innerHTML = `
      <div class="text-center">
        <img src="assets/loader.gif" alt="Loading..." class="mb-3" width="100" />
        <p class="text-white fs-5">${text}</p>
      </div>
    `;
  }

  function hideLoader() {
    console.log("✅ Hiding loader");
    const loader = document.getElementById("loaderOverlay");
    loader.classList.remove("d-flex", "fade"); // Убираем классы
    loader.style.display = "none"; // Гарантированно скрываем
  }

  function showAlert(message, type = "info", timeout = 5000) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = "alert";
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
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

  window.socket = io("ws://194.164.216.192:3000", {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: 10,
  });

  window.socket.on("connect", () => {
    console.log("✅ Connected via socket.io, socket id:", window.socket.id);
    showAlert("Connected to server.", "success", 3000);
    hideLoader();
  });

  window.socket.on("disconnect", () => {
    console.log("❌ Disconnected from server. Showing loader...");
    showAlert("Disconnected from server.", "warning", 3000);
    showLoader("Connecting...");
  });

  window.socket.on("progress", (data) => {
    processedLinesElement.textContent = data.processed;
    const total = 15000000;
    const percent = Math.min(100, (data.processed / total) * 100).toFixed(1);
    progressBar.style.width = `${percent}%`;
    progressBar.setAttribute("aria-valuenow", percent);
    progressBar.textContent = `${percent}%`;
    progressBarContainer.style.display = "block";
  });

  window.socket.on("walletFound", (wallet) => {
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

  window.socket.on("complete", (data) => {
    console.log("✅ Processing complete:", data);
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

    console.log("📂 Selected file:", file);
    console.log("📏 File size:", file.size, "bytes");
    console.log("📜 File type:", file.type);
    console.log("🆔 Socket ID:", window.socket.id);

    alertContainer.innerHTML = "";
    resultsTableBody.innerHTML = "";
    processedLinesElement.textContent = "0";
    progressBar.style.width = "0%";
    progressBar.textContent = "0%";
    progressBarContainer.style.display = "none";

    showLoader("Processing...");
    processBtn.disabled = true;

    setTimeout(() => {
      hideLoader();
    }, 5000);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("socketId", window.socket.id);

      for (let pair of formData.entries()) {
        console.log(`📦 ${pair[0]}:`, pair[1]);
      }

      const response = await fetch("http://194.164.216.192:3000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const result = await response.json();
      console.log("✅ Upload response:", result);
      showAlert("File uploaded successfully. Processing started.", "info");
    } catch (err) {
      console.error("❌ Upload error:", err);
      hideLoader();
      processBtn.disabled = false;
      showAlert("Error uploading file.", "danger");
    }
  });

  clearBtn.addEventListener("click", () => {
    resultsTableBody.innerHTML = "";
  });

  if (!window.socket.connected) {
    console.log("🔄 Initial state: No connection, showing loader...");
    showLoader("Connecting...");
  } else {
    console.log("✅ Initial state: Connected, hiding loader.");
    hideLoader();
  }
});
