const axios = require("axios");

const ELECTRUMX_URL = process.env.ELECTRUMX_URL;

async function electrumRequest(method, params) {
  try {
    const response = await axios.post(ELECTRUMX_URL, {
      jsonrpc: "2.0",
      id: method,
      method,
      params,
    });
    return response.data.result;
  } catch (error) {
    console.error(`❌ Ошибка ElectrumX RPC (${method}):`, error.message);
    return null;
  }
}

async function getWalletBalance(addresses) {
  const results = {};

  for (const [type, address] of Object.entries(addresses)) {
    console.log(`🟢 Проверка баланса для ${type}: ${address}`);
    results[type] = await electrumRequest("blockchain.address.get_balance", [
      address,
    ]);
  }

  return results;
}

module.exports = { getWalletBalance };

