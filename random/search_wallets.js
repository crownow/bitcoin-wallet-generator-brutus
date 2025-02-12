const sqlite3 = require("sqlite3").verbose();
const bitcoin = require("bitcoinjs-lib");
const crypto = require("crypto");
const fs = require("fs");

// Открываем базу
const db = new sqlite3.Database("wallets.db");

// Файл для найденных ключей
const foundKeysFile = "founded_hex.txt";

// Генерация случайного приватного ключа (SHA-256 HEX)
function generatePrivateKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Создание биткоин-адресов 4 типов
function generateBitcoinAddresses(privateKeyHex) {
  const keyPair = bitcoin.ECPair.fromPrivateKey(
    Buffer.from(privateKeyHex, "hex")
  );
  const { publicKey } = keyPair;
  const network = bitcoin.networks.bitcoin;

  return [
    bitcoin.payments.p2pkh({ pubkey: publicKey, network }).address, // P2PKH
    bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey, network }),
      network,
    }).address, // P2SH
    bitcoin.payments.p2wpkh({ pubkey: publicKey, network }).address, // P2WPKH
    bitcoin.payments.p2tr({ internalPubkey: publicKey.slice(1, 33), network })
      .address, // P2TR
  ];
}

// Функция для поиска адресов в базе
function checkWallets(addresses, privateKey) {
  db.all(
    `SELECT address FROM wallets WHERE address IN (?, ?, ?, ?)`,
    addresses,
    (err, rows) => {
      if (err) {
        console.error("❌ Ошибка поиска в базе:", err);
        return;
      }

      if (rows.length > 0) {
        console.log(`🎯 Найден приватный ключ! ${privateKey}`);
        fs.appendFileSync(foundKeysFile, `${privateKey}\n`);
      }
    }
  );
}

// Основной бесконечный цикл
function startSearching() {
  console.log("🚀 Начинаем поиск...");

  setInterval(() => {
    const privateKey = generatePrivateKey();
    const addresses = generateBitcoinAddresses(privateKey);
    checkWallets(addresses, privateKey);
  }, 1); // Каждую миллисекунду генерируем новый ключ
}

// Запуск
startSearching();
