const { parentPort, workerData } = require("worker_threads");
const { getWalletBalance, API_PROVIDERS } = require("./api"); // ✅ Импортируем API_PROVIDERS

async function processWallet(wallet) {
  console.log(`🟢 Обрабатываем кошелек: ${wallet.phrase}`);
  wallet.balance = await getWalletBalance(wallet.addresses);
  parentPort.postMessage(wallet);
}

processWallet(workerData);
