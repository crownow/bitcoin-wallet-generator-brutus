const workerpool = require("workerpool");
const bitcoin = require("bitcoinjs-lib");

// Функция для обработки фразы
function processPhrase(phrase) {
  try {
    const hash = bitcoin.crypto.sha256(Buffer.from(phrase)).toString("hex");

    // Генерируем ключи
    const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(hash, "hex"), {
      compressed: true,
    });

    return {
      privateKeyHex: hash,
      addresses: {
        p2pkh: bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey }).address,
        p2sh: bitcoin.payments.p2sh({
          redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey }),
        }).address,
        p2wpkh: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey }).address,
        p2tr: bitcoin.payments.p2tr({
          internalPubkey: keyPair.publicKey.slice(1, 33),
        }).address,
      },
    };
  } catch (err) {
    console.error("❌ Error in worker:", err);
    return { error: err.message, phrase };
  }
}

workerpool.worker({ processPhrase });
