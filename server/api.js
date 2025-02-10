const axios = require("axios");

const ELECTRUMX_URL = process.env.ELECTRUMX_URL;
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
  try {
    console.log("📡 Checking balance for addresses:", addresses);
    if (!addresses || typeof addresses !== "object") {
      throw new Error("Invalid addresses input");
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
  } catch (err) {
    console.error("❌ Error in getWalletBalance:", err);
    return null;
  }
}

module.exports = { electrumRequest, getWalletBalance };
