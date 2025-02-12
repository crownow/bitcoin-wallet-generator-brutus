const sqlite3 = require("sqlite3").verbose();
const bitcoin = require("bitcoinjs-lib");
const crypto = require("crypto");
const { parentPort, workerData } = require("worker_threads");
const ecc = require("tiny-secp256k1");
const ECPairFactory = require("ecpair").default;
const ECPair = ECPairFactory(ecc);

// Проверяем инициализацию ECC
try {
  bitcoin.initEccLib(ecc);
  console.log(`✅ Воркер ${process.pid} успешно инициализировал ECC.`);
} catch (error) {
  console.error(`❌ Ошибка инициализации ECC в воркере ${process.pid}:`, error);
  process.exit(1);
}

// Открываем SQLite в режиме "readonly"
const db = new sqlite3.Database("wallets.db", sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error(`❌ Ошибка открытия БД в воркере ${process.pid}:`, err);
    process.exit(1);
  }
});

// Получаем кошельки из главного процесса
const walletsSet = new Set(workerData);
console.log(`🔹 Воркер ${process.pid} получил ${walletsSet.size} адресов.`);

// Генерация случайного приватного ключа
function generatePrivateKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Создание биткоин-адресов 4 типов
function generateBitcoinAddresses(privateKeyHex) {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, "hex"));
  const publicKey = Buffer.from(keyPair.publicKey); // ✅ Исправлено

  return {
    p2pkh: bitcoin.payments.p2pkh({ pubkey: publicKey }).address,
    p2sh: bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey }),
    }).address,
    p2wpkh: bitcoin.payments.p2wpkh({ pubkey: publicKey }).address,
    p2tr: bitcoin.payments.p2tr({ internalPubkey: publicKey.slice(1, 33) })
      .address,
  };
}

// Функция поиска в базе с повтором при блокировке
function checkWalletsWithRetry(addresses, privateKey, retries = 5) {
  db.all(
    `SELECT address FROM wallets WHERE address IN (?, ?, ?, ?)`,
    [addresses.p2pkh, addresses.p2sh, addresses.p2wpkh, addresses.p2tr], // ✅ Исправлено
    (err, rows) => {
      if (err) {
        if (err.code === "SQLITE_BUSY" && retries > 0) {
          console.warn(
            `⚠️ БД занята в воркере ${process.pid}, повтор через 100мс...`
          );
          setTimeout(
            () => checkWalletsWithRetry(addresses, privateKey, retries - 1),
            100
          );
        } else {
          console.error(`❌ Ошибка в БД в воркере ${process.pid}:`, err);
        }
        return;
      }

      if (rows.length > 0) {
        console.log(`🎯 Воркер ${process.pid} нашёл ключ: ${privateKey}`);
        parentPort.postMessage(privateKey);
      }
    }
  );
}

// Логируем процесс каждые 100 000 адресов
let checkedAddresses = 0;
const startTime = Date.now();

// Бесконечный цикл поиска
async function startWorker() {
  while (true) {
    const privateKey = generatePrivateKey();
    const addresses = generateBitcoinAddresses(privateKey);

    checkWalletsWithRetry(addresses, privateKey);

    checkedAddresses += 4;
    if (checkedAddresses % 100000 === 0) {
      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(
        `🔍 Воркер ${process.pid} проверил ${checkedAddresses} адресов за ${elapsedTime} сек.`
      );
    }

    // Небольшая задержка, чтобы не перегружать БД
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

startWorker();
