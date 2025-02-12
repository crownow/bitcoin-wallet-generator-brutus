const { execSync } = require("child_process");

const RPC_USER = "bitcoinuser";
const RPC_PASSWORD = "supersecretpassword";
const RPC_PORT = 8332;
const BITCOIN_CLI_CMD = `bitcoin-cli -rpcuser=${RPC_USER} -rpcpassword=${RPC_PASSWORD} -rpcport=${RPC_PORT}`;

function runBitcoinCli(command, params = []) {
  try {
    const cmd = `${BITCOIN_CLI_CMD} ${command} ${params.join(" ")}`;
    console.log(`🔄 Executing: ${cmd}`);
    const output = execSync(cmd, { encoding: "utf-8" });

    if (!output || output.trim() === "") {
      throw new Error(
        `Empty response from Bitcoin Core for command: ${command}`
      );
    }

    return JSON.parse(output);
  } catch (error) {
    console.error(`❌ Error Bitcoin Core RPC (${command}):`, error.message);
    return null;
  }
}

// Проверить статус scantxoutset
function isScanInProgress() {
  try {
    const status = runBitcoinCli("scantxoutset", ["status"]);
    return status && status.progress < 1.0;
  } catch (error) {
    console.error("⚠️ Error checking scantxoutset status:", error.message);
    return false;
  }
}

// Ждем, пока идет сканирование
function waitForScan() {
  while (isScanInProgress()) {
    console.log("⏳ Scan in progress, waiting 5 seconds...");
    setTimeout(() => {}, 5000);
  }
}

// Получение баланса через scantxoutset
async function getWalletBalance(addresses) {
  const balances = {};
  const addrList = Object.values(addresses)
    .map((addr) => `"addr(${addr})"`)
    .join(", ");

  if (!addrList) {
    return balances;
  }

  waitForScan(); // Ждем, пока освободится сканирование

  try {
    const cmd = `${BITCOIN_CLI_CMD} scantxoutset start '[${addrList}]'`;
    console.log(
      `🚀 Running scantxoutset for ${
        Object.keys(addresses).length
      } addresses...`
    );
    const output = execSync(cmd, { encoding: "utf-8" });

    if (!output || output.trim() === "") {
      throw new Error("Empty response from Bitcoin Core scantxoutset");
    }

    const result = JSON.parse(output);

    if (!result || !result.success) {
      throw new Error(`scantxoutset failed: ${JSON.stringify(result)}`);
    }

    for (const unspent of result.unspents) {
      const addr = unspent.desc.match(/addr\((.*?)\)/)[1];
      balances[addr] = {
        balance: (balances[addr]?.balance || 0) + unspent.amount,
        transactions: (balances[addr]?.transactions || 0) + 1,
      };
    }

    // Заполняем пустые балансы
    for (const addr of Object.values(addresses)) {
      if (!balances[addr]) {
        balances[addr] = { balance: 0, transactions: 0 };
      }
    }
  } catch (error) {
    console.error(`❌ Error Bitcoin Core RPC (scantxoutset):`, error.message);
    for (const addr of Object.values(addresses)) {
      balances[addr] = { balance: 0, transactions: 0 };
    }
  }

  return balances;
}

module.exports = { getWalletBalance };
