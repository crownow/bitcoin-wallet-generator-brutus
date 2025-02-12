const { execSync } = require("child_process");

const RPC_USER = "bitcoinuser";
const RPC_PASSWORD = "supersecretpassword";
const RPC_PORT = 8332;
const BITCOIN_CLI_CMD = `bitcoin-cli -rpcuser=${RPC_USER} -rpcpassword=${RPC_PASSWORD} -rpcport=${RPC_PORT}`;

async function getWalletBalance(addresses) {
  const balances = {};
  const addrList = Object.values(addresses)
    .map((addr) => `"addr(${addr})"`)
    .join(", ");

  if (!addrList) {
    return balances;
  }

  try {
    const cmd = `${BITCOIN_CLI_CMD} scantxoutset start '[${addrList}]'`;
    const output = execSync(cmd, { encoding: "utf-8" });
    const result = JSON.parse(output);

    if (result.success) {
      for (const unspent of result.unspents) {
        const addr = unspent.desc.match(/addr\((.*?)\)/)[1];
        balances[addr] = {
          balance: (balances[addr]?.balance || 0) + unspent.amount,
          transactions: (balances[addr]?.transactions || 0) + 1,
        };
      }
    }

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
