const Client = require("bitcoin-core");
const client = new Client({
  network: "mainnet",
  username: "bitcoinuser",
  password: "supersecretpassword",
  port: 8332,
});

async function getWalletBalance(addresses) {
  const balances = {};
  const addrList = Object.values(addresses).map((addr) => `addr(${addr})`);

  try {
    console.log(`🚀 Запускаем scantxoutset для ${addrList.length} адресов...`);
    const result = await client.command(
      "scantxoutset",
      "start",
      `[${addrList.join(", ")}]`
    );

    if (!result || !result.success) {
      throw new Error(`scantxoutset неуспешен: ${JSON.stringify(result)}`);
    }

    for (const unspent of result.unspents) {
      const match = unspent.desc.match(/addr\((.*?)\)/);
      if (match) {
        const addr = match[1];
        balances[addr] = {
          balance: (balances[addr]?.balance || 0) + unspent.amount,
          transactions: (balances[addr]?.transactions || 0) + 1,
        };
      }
    }

    // Заполняем адреса, по которым не найдены UTXO
    for (const addr of Object.values(addresses)) {
      if (!balances[addr]) {
        balances[addr] = { balance: 0, transactions: 0 };
      }
    }
  } catch (error) {
    console.error(`❌ Ошибка при вызове scantxoutset: ${error.message}`);
    // Если произошла ошибка, возвращаем нулевые балансы
    for (const addr of Object.values(addresses)) {
      balances[addr] = { balance: 0, transactions: 0 };
    }
  }

  return balances;
}

module.exports = { getWalletBalance };
