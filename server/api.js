const axios = require("axios");

const ELECTRUMX_URL = process.env.ELECTRUMX_URL || "http://127.0.0.1:50001"; // Адрес сервера ElectrumX

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
    console.error(`❌ Error ElectrumX RPC (${method}):`, error.message);
    return null;
  }
}

async function getWalletBalance(addresses) {
  if (!addresses || typeof addresses !== "object") {
    console.error("❌ Invalid addresses input:", addresses);
    return null;
  }

  const balances = {};
  for (const [type, address] of Object.entries(addresses)) {
    console.log(`🔍 Checking balance for ${type}: ${address}`);
    const balance = await electrumRequest("blockchain.address.get_balance", [
      address,
    ]);
    balances[type] = balance || { balance: 0, transactions: 0 };
  }

  return balances;
}

module.exports = { electrumRequest, getWalletBalance };
