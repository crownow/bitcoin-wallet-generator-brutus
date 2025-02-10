require("dotenv").config();
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { processPhrase } = require("./wallet");
const { getWalletBalance } = require("./api");

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не загружен" });
  }

  try {
    const fileContent = fs
      .readFileSync(req.file.path, "utf-8")
      .trim()
      .split("\n");
    const results = fileContent.map((phrase) => processPhrase(phrase));
    const addresses = results.map((r) => r.addresses);

    const balances = await Promise.all(addresses.map(getWalletBalance));

    res.json(balances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка обработки" });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});

app.listen(PORT, () => console.log(`✅ API сервер запущен на порту ${PORT}`));
