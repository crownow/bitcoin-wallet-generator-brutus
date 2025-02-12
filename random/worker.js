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

// Получаем кошельки из главного процесса
const walletsSet = new Set(workerData);
console.log(`🔹 Воркер ${process.pid} получил ${walletsSet.size} адресов.`);

// Генерация случайного приватного ключа (SHA-256 HEX)
function generatePrivateKey() {
  return crypto.randomBytes(32).toString("hex");
}

// Создание биткоин-адресов 4 типов
function generateBitcoinAddresses(privateKeyHex) {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKeyHex, "hex"));
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

// Логируем процесс каждые 100 000 адресов
let checkedAddresses = 0;
const startTime = Date.now();

// Бесконечный цикл поиска
while (true) {
  const privateKey = generatePrivateKey();
  const addresses = generateBitcoinAddresses(privateKey);

  for (const address of addresses) {
    if (walletsSet.has(address)) {
      console.log(`🎯 Воркер ${process.pid} нашёл ключ: ${privateKey}`);
      parentPort.postMessage(privateKey);
    }
  }

  checkedAddresses += 4;

  if (checkedAddresses % 100000 === 0) {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `🔍 Воркер ${process.pid} проверил ${checkedAddresses} адресов за ${elapsedTime} сек.`
    );
  }
}
