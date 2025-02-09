const bitcoin = require("bitcoinjs-lib");
const crypto = require("crypto");
const wif = require("wif");
const tinysecp = require("tiny-secp256k1");
const ECPairFactory = require("ecpair").default;
const bs58check = require("bs58check");

// ✅ Инициализируем ECC библиотеку
bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

/**
 * Преобразует строку в SHA-256 хеш (HEX).
 * @param {string} phrase
 * @returns {string} 64-символьный HEX приватного ключа
 */
function sha256(phrase) {
  return crypto.createHash("sha256").update(phrase, "utf8").digest("hex");
}

/**
 * Генерирует WIF (Wallet Import Format) приватные ключи.
 * @param {string} privateKeyHex
 * @returns {string} WIF приватного ключа
 */
function generateWIF(privateKeyHex) {
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");

  if (privateKeyBuffer.length !== 32) {
    throw new Error(
      `Ошибка: Неверный размер ключа: ${privateKeyBuffer.length} байт`
    );
  }

  return wif.encode(128, privateKeyBuffer, true); // ✅ Только сжатый WIF
}

/**
 * Генерирует публичный ключ (сжатый, 33 байта).
 * @param {Buffer} privateKeyBuffer
 * @returns {Buffer} Сжатый публичный ключ
 */
function generatePublicKey(privateKeyBuffer) {
  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { compressed: true });
  return Buffer.from(keyPair.publicKey); // ✅ Преобразуем в Buffer
}

/**
 * Генерация Legacy P2PKH-адреса (начинается с "1").
 * @param {Buffer} publicKey
 * @returns {string} Bitcoin-адрес P2PKH
 */
function generateP2PKH(publicKey) {
  const shaHash = crypto.createHash("sha256").update(publicKey).digest();
  const ripemdHash = crypto.createHash("ripemd160").update(shaHash).digest();
  const mainnetPrefix = Buffer.concat([Buffer.from([0x00]), ripemdHash]);
  return bs58check.encode(mainnetPrefix);
}

/**
 * Генерация SegWit (P2SH-P2WPKH) (начинается с "3").
 * @param {Buffer} publicKey
 * @returns {string} Bitcoin-адрес P2SH
 */
function generateP2SH(publicKey) {
  return bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({
      pubkey: publicKey,
      network: bitcoin.networks.bitcoin,
    }),
  }).address;
}

/**
 * Генерация Native SegWit P2WPKH (начинается с "bc1").
 * @param {Buffer} publicKey
 * @returns {string} Bitcoin-адрес P2WPKH
 */
function generateP2WPKH(publicKey) {
  return bitcoin.payments.p2wpkh({
    pubkey: publicKey,
    network: bitcoin.networks.bitcoin,
  }).address;
}

/**
 * Генерация Taproot (P2TR) (начинается с "bc1p").
 * @param {Buffer} publicKey
 * @returns {string} Bitcoin-адрес P2TR
 */
function generateP2TR(publicKey) {
  const xOnlyPubkey = publicKey.slice(1, 33); // ✅ X-координата Schnorr-подписи
  return bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: bitcoin.networks.bitcoin,
  }).address;
}

/**
 * Генерация всех типов Bitcoin-адресов.
 * @param {Buffer} publicKey
 * @returns {Object} Объект с четырьмя типами адресов
 */
function generateBitcoinAddresses(publicKey) {
  return {
    p2pkh: generateP2PKH(publicKey),
    p2sh: generateP2SH(publicKey),
    p2wpkh: generateP2WPKH(publicKey),
    p2tr: generateP2TR(publicKey),
  };
}

/**
 * Полный процесс генерации Bitcoin-адресов.
 * @param {string} phrase
 * @returns {Object} Полный объект с данными
 */
function processPhrase(phrase) {
  console.log(`\n🚀 Обработка фразы: ${phrase}`);

  const privateKeyHex = sha256(phrase);
  const wifKey = generateWIF(privateKeyHex);
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");

  const publicKey = generatePublicKey(privateKeyBuffer);
  const addresses = generateBitcoinAddresses(publicKey);

  return {
    phrase,
    privateKeyHex,
    wifKey,
    publicKey: publicKey.toString("hex"),
    addresses,
  };
}

module.exports = { processPhrase };
