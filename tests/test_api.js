const { getWalletBalance } = require("../src/utils/api"); // ✅ Указываем правильный путь

(async () => {
  const addresses = {
    p2pkh: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    p2sh: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
    p2wpkh: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080",
    p2tr: "bc1p5cyxnuxmeuwuvkwfem96l5p9x3zx7uyfkw5j3w",
  };

  const balances = await getWalletBalance(addresses);
  console.log("💰 Балансы кошельков:", balances);
})();
