const crypto = require("crypto");
const wif = require("wif");
const ECPairFactory = require("ecpair").default;
const tinysecp = require("tiny-secp256k1");
const bitcoin = require("bitcoinjs-lib");

try {
  // ✅ Проверяем, действительно ли tiny-secp256k1 работает
  if (!tinysecp || !tinysecp.isPoint) {
    throw new Error("tiny-secp256k1 is not working properly");
  }

  bitcoin.initEccLib(tinysecp);
  console.log("✅ ECC library initialized successfully!");
} catch (error) {
  console.error("❌ ECC library failed to initialize:", error);
  process.exit(1);
}

const ECPair = ECPairFactory(tinysecp);

function sha256(phrase) {
  return crypto.createHash("sha256").update(phrase, "utf8").digest("hex");
}

function generatePrivateKey(phrase) {
  const privateKeyHex = sha256(phrase);
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");
  return { privateKeyHex, privateKeyBuffer };
}

function generateWIF(privateKeyHex) {
  return wif.encode(128, Buffer.from(privateKeyHex, "hex"), true);
}

function generatePublicKey(privateKeyBuffer) {
  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer);
  return {
    compressed: keyPair.publicKey,
    uncompressed: Buffer.concat([
      Buffer.from([0x04]),
      keyPair.publicKey.slice(1, 33),
      keyPair.publicKey.slice(33, 65),
    ]),
  };
}

function generateBitcoinAddresses(publicKey) {
  return {
    p2pkh: bitcoin.payments.p2pkh({ pubkey: publicKey.compressed }).address,
    p2sh: bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey.compressed }),
    }).address,
    p2wpkh: bitcoin.payments.p2wpkh({ pubkey: publicKey.compressed }).address,
    p2tr: bitcoin.payments.p2tr({
      internalPubkey: publicKey.compressed.slice(1, 33),
    }).address,
  };
}

function processPhrase(phrase) {
  console.log(`🚀 Processing phrase: ${phrase}`);
  const { privateKeyHex, privateKeyBuffer } = generatePrivateKey(phrase);
  const wifKey = generateWIF(privateKeyHex);
  const publicKey = generatePublicKey(privateKeyBuffer);
  const addresses = generateBitcoinAddresses(publicKey);

  return {
    phrase,
    privateKeyHex,
    wifKey,
    publicKey: {
      compressed: publicKey.compressed.toString("hex"),
      uncompressed: publicKey.uncompressed.toString("hex"),
    },
    addresses,
  };
}

module.exports = { processPhrase };
