const { processPhrase } = require("../src/utils/wallet");
const { getWalletBalance } = require("../src/utils/api");

(async function testWallet() {
  try {
    const phrase =
      "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks";

    console.log("\n🚀 Тест генерации Bitcoin-адресов...");
    const wallet = processPhrase(phrase);
    console.log("\n✅ Итоговые данные:\n", wallet);

    console.log("\n🚀 Тест API-запроса баланса...");
    const balanceData = await getWalletBalance(wallet.addresses); // ✅ Здесь все ок
    console.log("\n✅ Баланс по адресам:\n", balanceData);
  } catch (error) {
    console.error("\n❌ Ошибка теста:", error);
  }
})();
