const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const API_PROVIDERS = [
  "https://blockstream.info/api/address/",
  "https://mempool.space/api/address/",
  "https://api.blockcypher.com/v1/btc/main/addrs/",
  "https://sochain.com/api/v2/get_address_balance/BTC/",
  "https://blockchair.com/bitcoin/dashboards/address/",
  "https://sochain.com/api/v2/address/BTC/",
  "https://api.blockchain.info/haskoin-store/btc/address/",
];

let isProcessing = true;
let apiCooldown = new Map(); // Запоминаем временно заблокированные API

function stopProcessing() {
  isProcessing = false;
}

/**
 * 📌 Запрос с повторными попытками
 */
async function fetchWithRetries(url, retries = 3, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    if (!isProcessing) return null;

    try {
      console.log(`🔄 Попытка ${i + 1}: ${url}`);
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        httpsAgent,
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        console.warn(`⚠️ Ошибка запроса (${url}): ${status}`);

        if (status === 429) {
          console.warn(`⏳ API временно ограничено (429), ждем...`);
          apiCooldown.set(url, Date.now() + delay);
        }

        if (status === 404) {
          console.warn(`🚫 Адрес не найден (${url})`);
          return { balance: 0, transactions: 0 };
        }
      }

      if (i < retries - 1) {
        console.log(`⏳ Ждем ${delay / 1000} секунд и пробуем снова...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  return null;
}

/**
 * ✅ Проверяет баланс по API с учетом блокировок 429
 */
async function fetchBalance(address) {
  const availableAPIs = API_PROVIDERS.filter((api) => {
    const cooldown = apiCooldown.get(api);
    return !cooldown || Date.now() > cooldown; // Исключаем временно заблокированные API
  });

  if (availableAPIs.length === 0) {
    console.warn(`🚨 Все API временно заблокированы, ждем 10 секунд...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return fetchBalance(address); // Пробуем снова
  }

  for (const api of availableAPIs) {
    if (!isProcessing)
      return { balance: "Остановлено", transactions: "Остановлено" };

    try {
      console.log(`🔹 Проверяем баланс через API: ${api}${address}`);
      const data = await fetchWithRetries(`${api}${address}`);

      if (data) {
        return {
          balance: data.chain_stats?.funded_txo_sum / 1e8 || 0,
          transactions: data.chain_stats?.tx_count || 0,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Ошибка API (${api}):`, error.message);
    }
  }

  return { balance: "Ошибка", transactions: "Ошибка" };
}

/**
 * 🏦 Получает баланс и транзакции для всех адресов
 */
async function getWalletBalance(addresses) {
  if (
    !addresses ||
    typeof addresses !== "object" ||
    Object.keys(addresses).length === 0
  ) {
    throw new Error("❌ Ошибка: Неверный объект адресов!");
  }

  const results = {};

  for (const [type, address] of Object.entries(addresses)) {
    if (!isProcessing) {
      console.warn("⏹️ Обработка остановлена. Выход из getWalletBalance.");
      break;
    }

    if (!address || address === "Ошибка") {
      results[type] = { balance: "Ошибка", transactions: "Ошибка" };
      continue;
    }

    console.log(`🟢 Запрос баланса для ${type}: ${address}`);
    results[type] = await fetchBalance(address);
  }

  return results;
}

module.exports = { getWalletBalance, API_PROVIDERS, stopProcessing };
