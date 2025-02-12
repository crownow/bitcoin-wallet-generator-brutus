const sqlite3 = require("sqlite3").verbose();
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1"); // Библиотека ECC
const wif = require("wif");
const crypto = require("crypto");
const fs = require("fs");

const ECPairFactory = require("ecpair").default;
const ECPair = ECPairFactory(ecc); // Создаём ECPair

// Проверка библиотеки ECC
try {
  if (!ecc || !ecc.isPoint) {
    throw new Error("tiny-secp256k1 is not working properly");
  }
  bitcoin.initEccLib(ecc);
  console.log("✅ ECC library initialized successfully!");
} catch (error) {
  console.error("❌ ECC library failed to initialize:", error);
  process.exit(1);
}

// Открываем базу
const db = new sqlite3.Database("wallets.db");

// Файл для найденных ключей
const foundKeysFile = "founded_hex.txt";

// Генерация случайного приватного ключа (SHA-256 HEX)
function generatePrivateKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Генерация WIF-формата ключа
function generateWIF(privateKeyHex) {
  return wif.encode(128, Buffer.from(privateKeyHex, "hex"), true);
}

// Генерация публичного ключа (сжатый и несжатый формат)
function generatePublicKey(privateKeyHex) {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, "hex"));

  // Преобразуем Uint8Array в Buffer
  const compressed = Buffer.from(keyPair.publicKey);
  const uncompressed = Buffer.concat([
    Buffer.from([0x04]),
    keyPair.publicKey.slice(1, 33),
    keyPair.publicKey.slice(33, 65),
  ]);

  return { compressed, uncompressed };
}

// Создание биткоин-адресов 4 типов
function generateBitcoinAddresses(publicKey) {
  return {
    p2pkh: bitcoin.payments.p2pkh({ pubkey: Buffer.from(publicKey.compressed) })
      .address,
    p2sh: bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(publicKey.compressed),
      }),
    }).address,
    p2wpkh: bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(publicKey.compressed),
    }).address,
    p2tr: bitcoin.payments.p2tr({
      internalPubkey: Buffer.from(publicKey.compressed.slice(1, 33)),
    }).address,
  };
}

// Функция для поиска адресов в базе
function checkWallets(addresses, privateKey) {
  db.all(
    `SELECT address FROM wallets WHERE address IN (?, ?, ?, ?)`,
    Object.values(addresses),
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

// Основной бесконечный цикл поиска
function startSearching() {
  console.log("🚀 Начинаем поиск...");

  setInterval(() => {
    const privateKeyHex = generatePrivateKey();
    const publicKey = generatePublicKey(privateKeyHex);
    const addresses = generateBitcoinAddresses(publicKey);
    checkWallets(addresses, privateKeyHex);
  }, 1); // Генерация нового ключа каждую миллисекунду
}

// Запуск поиска
startSearching();
