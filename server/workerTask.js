const workerpool = require("workerpool");
const bitcoin = require("bitcoinjs-lib");
const ECPairFactory = require("ecpair").default;
const tinysecp = require("tiny-secp256k1");

try {
  if (!tinysecp || !tinysecp.isPoint) {
    throw new Error("tiny-secp256k1 is not working properly in worker");
  }

  bitcoin.initEccLib(tinysecp);
  console.log("✅ Worker ECC library initialized successfully!");
} catch (error) {
  console.error("❌ Worker ECC library failed to initialize:", error);
  process.exit(1);
}

const ECPair = ECPairFactory(tinysecp);

function processPhrase(phrase) {
  try {
    const hash = bitcoin.crypto.sha256(Buffer.from(phrase)).toString("hex");
    const privateKeyBuffer = Buffer.from(hash, "hex");
    const keyPair = ECPair.fromPrivateKey(privateKeyBuffer);

    return {
      privateKeyHex: hash,
      addresses: {
        p2pkh: bitcoin.payments.p2pkh({
          pubkey: Buffer.from(keyPair.publicKey),
        }).address,
        p2sh: bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({
            pubkey: Buffer.from(keyPair.publicKey),
          }),
        }).address,
        p2wpkh: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(keyPair.publicKey),
        }).address,
        p2tr: bitcoin.payments.p2tr({
          internalPubkey: Buffer.from(keyPair.publicKey.slice(1, 33)),
        }).address,
      },
    };
  } catch (err) {
    console.error("❌ Error in worker:", err);
    return { error: err.message, phrase };
  }
}

workerpool.worker({ processPhrase });
