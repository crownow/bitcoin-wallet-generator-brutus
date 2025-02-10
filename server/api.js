// server/api.js
const axios = require("axios");

const ELECTRUMX_URL = process.env.ELECTRUMX_URL;
// Простой in-memory cache для результатов запросов
const balanceCache = new Map();

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
  const results = {};
  for (const [type, address] of Object.entries(addresses)) {
    if (balanceCache.has(address)) {
      console.log(`Cache hit for ${address}`);
      results[type] = balanceCache.get(address);
    } else {
      console.log(`Checking balance for ${address}`);
      const result = await electrumRequest("blockchain.address.get_balance", [
        address,
      ]);
      results[type] = result;
      balanceCache.set(address, result);
    }
  }
  return results;
}

module.exports = { electrumRequest, getWalletBalance };
