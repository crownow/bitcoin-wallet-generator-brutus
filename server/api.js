const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

// Укажи правильные RPC параметры для Bitcoin Core
const RPC_USER = "bitcoinuser";
const RPC_PASSWORD = "supersecretpassword";
const RPC_PORT = 8332;
const RPC_HOST = "127.0.0.1"; // Локальный Bitcoin Core

const BITCOIN_CLI_CMD = `bitcoin-cli -rpcuser=${RPC_USER} -rpcpassword=${RPC_PASSWORD} -rpcport=${RPC_PORT}`;

// Функция для выполнения команд через bitcoin-cli
async function bitcoinCliCommand(command, params = []) {
  try {
    const cmd = `${BITCOIN_CLI_CMD} ${command} ${params.join(" ")}`;
    const { stdout } = await execAsync(cmd);
    return JSON.parse(stdout);
  } catch (error) {
    console.error(`❌ Error Bitcoin Core RPC (${command}):`, error.message);
    return null;
  }
}

// Получение баланса адреса через `getreceivedbyaddress`
async function getWalletBalance(addresses) {
  if (!addresses || typeof addresses !== "object") {
    console.error("❌ Invalid addresses input:", addresses);
    return null;
  }

  const balances = {};
  for (const [type, address] of Object.entries(addresses)) {
    console.log(`🔍 Checking balance for ${type}: ${address}`);

    // Запрос через `getreceivedbyaddress` (Bitcoin Core)
    const balance = await bitcoinCliCommand("getreceivedbyaddress", [address]);

    balances[type] = balance || 0;
  }

  return balances;
}

// Проверка существования адреса в UTXO (наличие неподтвержденных выходов)
async function checkAddressUTXO(address) {
  const utxo = await bitcoinCliCommand("scantxoutset", [
    "start",
    `[{ "desc": "addr(${address})", "range": 1000 }]`,
  ]);
  return utxo || {};
}

module.exports = { bitcoinCliCommand, getWalletBalance, checkAddressUTXO };
