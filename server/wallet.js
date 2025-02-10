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

function generateP2PKH(publicKey) {
  const shaHash = crypto.createHash("sha256").update(publicKey).digest();
  const ripemdHash = crypto.createHash("ripemd160").update(shaHash).digest();
  const mainnetPrefix = Buffer.concat([Buffer.from([0x00]), ripemdHash]);
  return bs58check.encode(mainnetPrefix);
}

function processPhrase(phrase) {
  console.log(`\n🚀 Обработка фразы: ${phrase}`);

  const privateKeyHex = sha256(phrase);
  const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");

  const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { compressed: true });
  const publicKey = keyPair.publicKey;

  return {
    phrase,
    privateKeyHex,
    publicKey: publicKey.toString("hex"),
    addresses: {
      p2pkh: generateP2PKH(publicKey),
    },
  };
}

module.exports = { processPhrase };
