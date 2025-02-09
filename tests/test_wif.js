const crypto = require("crypto");
const wif = require("wif");

// Функция SHA-256 для преобразования фразы в приватный ключ (HEX)
function sha256(phrase) {
  return crypto
    .createHash("sha256")
    .update(Buffer.from(phrase, "utf8"))
    .digest("hex");
}

// Тестовая фраза
const testPhrase =
  "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks";

// Генерация приватного ключа
const privateKeyHex = sha256(testPhrase);
console.log(`✅ SHA-256: ${privateKeyHex}`);
console.log(`✅ Длина ключа: ${privateKeyHex.length} символов (ожидается 64)`);

// Преобразуем HEX в Buffer
const privateKeyBuffer = Buffer.from(privateKeyHex, "hex");

// 🔥 Проверяем, действительно ли это 32-байтовый приватный ключ
if (privateKeyBuffer.length !== 32) {
  console.error(
    `❌ Ошибка: Приватный ключ имеет неверную длину (${privateKeyBuffer.length} байт)`
  );
  process.exit(1);
}
console.log(`✅ Buffer length: ${privateKeyBuffer.length} байт (ожидается 32)`);

// Проверяем WIF-формат
try {
  const compressedWIF = wif.encode(128, privateKeyBuffer, true);
  const uncompressedWIF = wif.encode(128, privateKeyBuffer, false);

  console.log(`✅ Сжатый WIF: ${compressedWIF}`);
  console.log(`✅ Несжатый WIF: ${uncompressedWIF}`);
} catch (error) {
  console.log(
    `🔹 Проверяем privateKeyBuffer перед wif.encode():`,
    privateKeyBuffer
  );
  console.log(`🔹 HEX приватного ключа: ${privateKeyBuffer.toString("hex")}`);

  console.error(`❌ Ошибка при генерации WIF: ${error.message}`);
}
