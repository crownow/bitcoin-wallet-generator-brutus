const bitcoin = require("bitcoinjs-lib");
const crypto = require("crypto");
const { parentPort, workerData } = require("worker_threads");

// Указываем сеть (mainnet)
const network = bitcoin.networks.bitcoin;
const walletsSet = new Set(workerData); // Получаем кошельки из главного процесса

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

// Бесконечный цикл (Работает в отдельном потоке)
while (true) {
  const privateKey = generatePrivateKey();
  const addresses = generateBitcoinAddresses(privateKey);

  // Проверяем сразу **все** 4 адреса
  for (const address of addresses) {
    if (walletsSet.has(address)) {
      parentPort.postMessage(privateKey); // Сообщаем в главный процесс
    }
  }
}
