const bitcoin = require("bitcoinjs-lib");
const crypto = require("crypto");
const wif = require("wif");
const tinysecp = require("tiny-secp256k1");
const ECPairFactory = require("ecpair").default;
const bs58check = require("bs58check");

bitcoin.initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

function sha256(phrase) {
  return crypto.createHash("sha256").update(phrase, "utf8").digest("hex");
}

function generateWIF(privateKeyHex) {
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");
  if (privateKeyBuffer.length !== 32) {
    throw new Error(
      `Ошибка: Неверный размер ключа: ${privateKeyBuffer.length} байт`
    );
  }
  return wif.encode(128, privateKeyBuffer, true);
}

function generatePublicKey(privateKeyBuffer) {
  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { compressed: true });
  return keyPair.publicKey;
}

function generateP2PKH(publicKey) {
  const shaHash = crypto.createHash("sha256").update(publicKey).digest();
  const ripemdHash = crypto.createHash("ripemd160").update(shaHash).digest();
  return bs58check.encode(Buffer.concat([Buffer.from([0x00]), ripemdHash]));
}

function generateP2SH(publicKey) {
  return bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey }),
  }).address;
}

function generateP2WPKH(publicKey) {
  return bitcoin.payments.p2wpkh({ pubkey: publicKey }).address;
}

function generateP2TR(publicKey) {
  const xOnlyPubkey =
    publicKey.length === 33 ? publicKey.slice(1, 33) : publicKey;
  return bitcoin.payments.p2tr({ internalPubkey: xOnlyPubkey }).address;
}

function generateBitcoinAddresses(publicKey) {
  return {
    p2pkh: generateP2PKH(publicKey),
    p2sh: generateP2SH(publicKey),
    p2wpkh: generateP2WPKH(publicKey),
    p2tr: generateP2TR(publicKey),
  };
}

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
